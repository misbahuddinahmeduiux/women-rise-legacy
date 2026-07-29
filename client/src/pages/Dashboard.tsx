import { type CSSProperties, type FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight, Bell, BookOpenCheck, BriefcaseBusiness, CalendarDays, Check,
  CheckCircle2, CircleDollarSign, Crown, Download, HandHeart, LayoutDashboard,
  LockKeyhole, Pencil, ReceiptText, Save, Sparkles, Target, UserRoundCheck,
  Users, WalletCards, XCircle, ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Field, TextArea } from '../components/FormFields';
import { ErrorBox, Loader, SuccessBox } from '../components/UI';
import { Seo } from '../components/Seo';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { MemberProfile, MembershipPayment, MembershipSubscription, ResourceItem } from '../types';

type Preferences = { transactional_email: boolean; donation_updates: boolean; application_updates: boolean; event_reminders: boolean; newsletter: boolean };
type DashboardData = {
  profile: MemberProfile & { membership_expires_at?: string | null; membership_started_at?: string | null; membership_billing_cycle?: string | null; plan?: any };
  donations: any[]; recurringDonations: any[]; volunteerApplications: any[]; partnerApplications: any[]; assistanceRequests: any[];
  membershipApplications: any[]; mentorRequests: any[]; eventRegistrations: any[]; resources: ResourceItem[];
  membershipPayments: MembershipPayment[]; membershipSubscriptions: MembershipSubscription[]; mentorshipMatches: any[]; mentorSessions: any[];
  notificationPreferences: Preferences;
};

type OnboardingItem = { label: string; complete: boolean; to: string; note: string };

function displayStatus(value?: string | null) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not started';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState('');
  const load = () => api<DashboardData>('/dashboard/me').then(setData).catch((requestError) => setError(requestError.message));
  useEffect(() => { void load(); }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaved(''); setError('');
    const fd = new FormData(event.currentTarget);
    const payload = {
      fullName: fd.get('fullName'), phone: fd.get('phone'), country: fd.get('country'), city: fd.get('city'), avatarUrl: fd.get('avatarUrl'),
      headline: fd.get('headline'), bio: fd.get('bio'), skills: fd.get('skills'), linkedinUrl: fd.get('linkedinUrl'), websiteUrl: fd.get('websiteUrl'),
      businessName: fd.get('businessName'), isDirectoryVisible: fd.get('isDirectoryVisible') === 'on'
    };
    try { await api('/network/profile', { method: 'PUT', body: JSON.stringify(payload) }); setSaved('Profile updated successfully.'); setEditing(false); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Profile could not be updated.'); }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const fd = new FormData(event.currentTarget);
    try {
      await api('/dashboard/notification-preferences', { method: 'PUT', body: JSON.stringify({
        transactionalEmail: fd.get('transactionalEmail') === 'on', donationUpdates: fd.get('donationUpdates') === 'on',
        applicationUpdates: fd.get('applicationUpdates') === 'on', eventReminders: fd.get('eventReminders') === 'on', newsletter: fd.get('newsletter') === 'on'
      }) });
      setSaved('Notification preferences saved.'); await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Preferences could not be saved.'); }
  }

  async function cancelEvent(id: string) {
    if (!confirm('Cancel this event registration?')) return;
    try { await api(`/dashboard/event-registrations/${id}/cancel`, { method: 'POST' }); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Registration could not be cancelled.'); }
  }
  async function cancelRecurring(id: string) {
    if (!confirm('Cancel this recurring donation?')) return;
    try { await api(`/payments/recurring/${id}/cancel`, { method: 'POST' }); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Recurring donation could not be cancelled.'); }
  }
  async function cancelMembership(id: string) {
    if (!confirm('Cancel renewal at the end of the current paid period?')) return;
    try {
      await api(`/memberships/subscriptions/${id}/cancel`, { method: 'POST' });
      setSaved('Membership renewal cancellation requested. Access remains active until the current period ends.'); await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Membership could not be cancelled.'); }
  }

  if (error && !data) return <div className="page-center"><ErrorBox message={error} /></div>;
  if (!data) return <Loader />;

  const p = data.profile;
  const isActiveMember = ['active', 'trialing'].includes(p.membership_status);
  const activeApplications = data.membershipApplications.length + data.mentorRequests.length + data.eventRegistrations.length;
  const activeSubscription = data.membershipSubscriptions.find((row) => ['trialing', 'active', 'past_due', 'paused'].includes(row.status));
  const mentorshipAccess = p.plan?.mentorship_access || 'browse';
  const receiptCount = data.membershipPayments.filter((payment) => payment.receipt_number).length + data.donations.filter((donation) => donation.receipt_number).length;
  const profileFields = [p.full_name, p.avatar_url, p.headline, p.bio, p.city, p.country, p.skills?.length, p.linkedin_url || p.website_url];
  const profileScore = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);
  const displayName = p.full_name || user?.email?.split('@')[0] || 'Member';
  const currentPlan = p.plan?.name || (p.membership_level ? displayStatus(p.membership_level) : 'No active plan');

  const onboarding: OnboardingItem[] = [
    { label: 'Email verified', complete: Boolean(user?.email_confirmed_at), to: '/dashboard', note: 'Your secure account is ready.' },
    { label: 'Complete your profile', complete: profileScore >= 75, to: '/dashboard#profile', note: `${profileScore}% profile completion` },
    { label: 'Choose membership', complete: isActiveMember, to: '/membership', note: isActiveMember ? `${currentPlan} is active` : 'Unlock network access' },
    { label: 'Directory visibility', complete: Boolean(p.is_directory_visible), to: '/dashboard#profile', note: p.is_directory_visible ? 'Your profile can be discovered' : 'Enable when your profile is ready' },
    { label: 'Explore the network', complete: data.eventRegistrations.length > 0 || data.resources.length > 0, to: '/resources', note: 'Resources, events and connections' }
  ];
  const onboardingDone = onboarding.filter((item) => item.complete).length;
  const canAccessAdmin = ['admin', 'content_manager', 'donation_manager'].includes(p.role);
  const canAccessMentor = Boolean(p.is_mentor || p.role === 'mentor' || p.role === 'admin');

  const planActions = p.membership_level === 'elite'
    ? [{ to: '/mentor-request', label: 'Priority mentorship', Icon: Crown }, { to: '/events', label: 'Premium events', Icon: CalendarDays }, { to: '/resources', label: 'Elite resources', Icon: BookOpenCheck }]
    : p.membership_level === 'legacy'
      ? [{ to: '/mentor-request', label: 'Request a mentor', Icon: UserRoundCheck }, { to: '/events', label: 'Upcoming events', Icon: CalendarDays }, { to: '/resources', label: 'Member resources', Icon: BookOpenCheck }]
      : [{ to: '/members', label: 'Member directory', Icon: Users }, { to: '/mentors', label: 'Browse mentors', Icon: UserRoundCheck }, { to: '/resources', label: 'Explore resources', Icon: BookOpenCheck }];

  return <section className="dashboard-page member-dashboard-v2">
    <Seo title="Member Dashboard" description="Manage your Women Rise Legacy membership, profile, mentorship, receipts, events, and preferences." noIndex />
    <div className="container member-dashboard-container">
      <header className="member-command-hero">
        <div className="member-command-copy">
          <span className="member-kicker"><LayoutDashboard />Personal command centre</span>
          <h1>Welcome back, {displayName}.</h1>
          <p>{isActiveMember ? `Your ${currentPlan} membership is active. Continue building connections, knowledge and impact.` : 'Complete your profile and choose a membership to unlock your network experience.'}</p>
          <div className="member-command-actions">
            {!isActiveMember && <Link className="member-primary-action" to="/membership"><Crown />Choose membership<ArrowRight /></Link>}
            <button className="member-secondary-action" onClick={() => setEditing(true)}><Pencil />Update profile</button>
            {canAccessAdmin && <Link className="member-secondary-action" to="/admin"><ShieldCheck />Admin workspace</Link>}
            {canAccessMentor && <Link className="member-secondary-action" to="/mentor-dashboard"><UserRoundCheck />Mentor workspace</Link>}
          </div>
        </div>
        <div className="member-plan-card">
          <span className={`membership-chip ${p.membership_level || 'all'}`}><Crown />{currentPlan}</span>
          <strong>{displayStatus(p.membership_status)}</strong>
          <small>{p.membership_expires_at ? `Access through ${new Date(p.membership_expires_at).toLocaleDateString()}` : isActiveMember ? 'Ongoing membership access' : 'Choose a plan to activate access'}</small>
          <div className="member-profile-meter"><span><b>{profileScore}%</b> profile complete</span><i><b style={{ width: `${profileScore}%` }} /></i></div>
        </div>
      </header>

      {saved && <SuccessBox message={saved} />}{error && <ErrorBox message={error} />}

      <section className="member-onboarding-card">
        <div className="member-onboarding-heading">
          <div><span className="eyebrow">Your next steps</span><h2>{onboardingDone === onboarding.length ? 'Your member setup is complete' : 'Finish setting up your member experience'}</h2></div>
          <div className="member-progress-ring" style={{ '--progress': `${(onboardingDone / onboarding.length) * 360}deg` } as CSSProperties}><span>{onboardingDone}/{onboarding.length}</span></div>
        </div>
        <div className="member-onboarding-grid">{onboarding.map((item) => <Link key={item.label} to={item.to} className={item.complete ? 'complete' : ''}><span>{item.complete ? <Check /> : <Target />}</span><div><strong>{item.label}</strong><small>{item.note}</small></div><ArrowRight /></Link>)}</div>
      </section>

      <div className="member-stat-grid">
        <article><span><Crown /></span><div><small>Membership</small><strong>{currentPlan}</strong><b>{displayStatus(p.membership_status)}</b></div></article>
        <article><span><HandHeart /></span><div><small>Giving</small><strong>{data.donations.length}</strong><b>Donation records</b></div></article>
        <article><span><ReceiptText /></span><div><small>Receipts</small><strong>{receiptCount}</strong><b>Available records</b></div></article>
        <article><span><CalendarDays /></span><div><small>Events</small><strong>{data.eventRegistrations.length}</strong><b>Registrations</b></div></article>
        <article><span><BriefcaseBusiness /></span><div><small>Activity</small><strong>{activeApplications}</strong><b>Open records</b></div></article>
      </div>

      <section className="member-quick-actions">
        <div><span className="eyebrow">Plan-aware shortcuts</span><h2>Continue where it matters most</h2></div>
        <div>{planActions.map(({ to, label, Icon }) => <Link key={to + label} to={to}><span><Icon /></span><strong>{label}</strong><ArrowRight /></Link>)}</div>
      </section>

      <div className="dashboard-grid member-dashboard-grid-v2">
        <section className="dashboard-panel membership-summary-panel member-panel-featured">
          <div className="panel-heading"><div><span className="eyebrow">Membership</span><h2>Your plan and billing</h2></div><Link className="button ghost" to="/membership">View plans</Link></div>
          {isActiveMember ? <div className="membership-dashboard-summary"><div><Crown /><span><b>{currentPlan} membership</b><small>{displayStatus(p.membership_billing_cycle || activeSubscription?.billing_cycle || 'active access')}</small></span></div><dl><div><dt>Status</dt><dd>{displayStatus(p.membership_status)}</dd></div><div><dt>Mentorship</dt><dd>{mentorshipAccess === 'priority' ? 'Priority / private' : mentorshipAccess === 'request' ? 'Requests enabled' : 'Browse mentors'}</dd></div><div><dt>Started</dt><dd>{p.membership_started_at ? new Date(p.membership_started_at).toLocaleDateString() : '—'}</dd></div><div><dt>Renews / expires</dt><dd>{p.membership_expires_at ? new Date(p.membership_expires_at).toLocaleDateString() : 'Lifetime / ongoing'}</dd></div></dl>{activeSubscription && !activeSubscription.cancel_at_period_end && activeSubscription.billing_cycle !== 'one_time' && <button className="button ghost danger-button" onClick={() => cancelMembership(activeSubscription.id)}>Cancel renewal</button>}{activeSubscription?.cancel_at_period_end && <p className="status-note">Renewal is cancelled. Access remains available until the current paid period ends.</p>}</div>
            : <div className="empty-inline"><WalletCards /><div><b>No active membership</b><p>Select a Rise, Legacy, or Elite plan to unlock the complete member experience.</p></div><Link className="button" to="/membership">Choose membership</Link></div>}
          {data.membershipPayments.length > 0 && <div className="membership-payment-list"><h3>Recent membership payments</h3>{data.membershipPayments.slice(0, 5).map((payment) => <div key={payment.id}><span><b>{payment.plan?.name || 'Membership'}</b><small>{new Date(payment.created_at).toLocaleDateString()} · {displayStatus(payment.billing_cycle)}</small></span><span>{payment.currency.toUpperCase()} {Number(payment.amount).toLocaleString()}<small>{displayStatus(payment.status)}{payment.receipt_number ? <> · <Link className="text-link" to={`/membership-receipt/${payment.receipt_token}`}>{payment.receipt_number}</Link></> : ''}</small></span></div>)}</div>}
        </section>

        <section className="dashboard-panel profile-panel" id="profile">
          <div className="panel-heading"><div><span className="eyebrow">Member profile</span><h2>Your public presence</h2></div><button className="button ghost" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : <><Pencil size={16} />Edit profile</>}</button></div>
          {editing ? <form className="form-grid professional-form-grid" onSubmit={saveProfile}><Field label="Full name" name="fullName" defaultValue={p.full_name || ''} required /><Field label="Headline" name="headline" defaultValue={p.headline || ''} /><Field label="Phone" name="phone" defaultValue={p.phone || ''} /><Field label="City" name="city" defaultValue={p.city || ''} /><Field label="Country" name="country" defaultValue={p.country || ''} /><Field label="Business name" name="businessName" defaultValue={p.business_name || ''} /><Field label="Avatar image URL" name="avatarUrl" defaultValue={p.avatar_url || ''} /><Field label="Skills (comma separated)" name="skills" defaultValue={(p.skills || []).join(', ')} /><Field label="Website URL" name="websiteUrl" defaultValue={p.website_url || ''} /><Field label="LinkedIn URL" name="linkedinUrl" defaultValue={p.linkedin_url || ''} /><TextArea label="Short biography" name="bio" defaultValue={p.bio || ''} /><label className="checkbox full"><input type="checkbox" name="isDirectoryVisible" defaultChecked={p.is_directory_visible} />Show my approved profile in the member directory</label><button className="button full"><Save size={16} />Save profile</button></form>
            : <div className="profile-preview professional-profile-preview"><div className="profile-avatar-wrap"><img src={p.avatar_url || '/assets/brand/logo-mark.webp'} alt="" /><span>{profileScore}%</span></div><div><h3>{p.full_name}</h3><strong>{p.headline || 'Women Rise Legacy member'}</strong><p>{p.bio || 'Add a biography to introduce your experience, interests, and the legacy you are building.'}</p><div className="tag-row">{(p.skills || []).map((skill) => <span key={skill}>{skill}</span>)}</div><small>{p.is_directory_visible ? <><CheckCircle2 />Directory visibility enabled</> : <><LockKeyhole />Directory visibility is currently off</>}</small></div></div>}
        </section>

        <section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">Member library</span><h2>Your resources</h2></div><Link className="text-link" to="/resources">View library</Link></div>{data.resources.length ? <div className="resource-mini-list">{data.resources.slice(0, 6).map((resource) => <div key={resource.id}><div><strong>{resource.title}</strong><span>{resource.resource_type} · {displayStatus(resource.membership_level)}</span></div>{(resource.file_url || resource.external_url) ? <a href={resource.file_url || resource.external_url || '#'} target="_blank" rel="noreferrer" aria-label={`Open ${resource.title}`}><Download /></a> : <span className="locked">Request access</span>}</div>)}</div> : <div className="panel-empty-state"><BookOpenCheck /><strong>No resources assigned yet</strong><p>Resources matching your membership level will appear here.</p></div>}</section>

        <section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">Mentorship</span><h2>Your matches and sessions</h2></div>{mentorshipAccess !== 'browse' && <Link className="text-link" to="/mentor-request">Request a mentor</Link>}</div><div className="record-list">{data.mentorshipMatches.map((match) => { const other = match.member_id === p.id ? match.mentor : match.member; return <div key={match.id}><Users /><div><strong>{other?.full_name || 'Mentorship match'}</strong><small>{match.goals || `${displayStatus(match.priority)} mentorship`}</small></div><b>{displayStatus(match.status)}</b></div>; })}{data.mentorSessions.slice(0, 5).map((session) => <div key={session.id}><CalendarDays /><div><strong>{session.agenda || 'Mentorship session'}</strong><small>{new Date(session.scheduled_at).toLocaleString()} · {session.duration_minutes} minutes</small></div><b>{displayStatus(session.status)}</b></div>)}{!data.mentorshipMatches.length && !data.mentorSessions.length && <div className="panel-empty-state"><UserRoundCheck /><strong>No active mentorship yet</strong><p>{mentorshipAccess === 'browse' ? 'Browse mentors available in the network.' : 'Submit a mentorship request when you are ready.'}</p></div>}</div></section>

        <section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">Applications</span><h2>Membership and mentorship</h2></div></div><div className="record-list">{data.membershipApplications.map((application) => <div key={application.id}><span className="membership-chip">{application.requested_level}</span><div><strong>Membership application</strong><small>{new Date(application.created_at).toLocaleDateString()}</small></div><b>{displayStatus(application.status)}</b></div>)}{data.mentorRequests.map((request) => <div key={request.id}><Users /><div><strong>Mentorship: {request.preferred_topics}</strong><small>{request.mentor?.full_name ? `Preferred mentor: ${request.mentor.full_name}` : 'Open matching request'}</small></div><b>{displayStatus(request.status)}</b></div>)}{!data.membershipApplications.length && !data.mentorRequests.length && <div className="panel-empty-state"><Target /><strong>No open applications</strong><p>Your submitted membership and mentorship records will appear here.</p></div>}</div><div className="panel-actions"><Link className="button ghost" to="/membership">Choose membership</Link>{mentorshipAccess !== 'browse' && <Link className="button ghost" to="/mentor-request">Request a mentor</Link>}</div></section>

        <section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">Events</span><h2>Your registrations</h2></div><Link className="text-link" to="/events">Browse events</Link></div><div className="record-list">{data.eventRegistrations.map((registration) => <div key={registration.id}><CalendarDays /><div><strong>{registration.event?.title || 'Network event'}</strong><small>{registration.event?.start_at ? new Date(registration.event.start_at).toLocaleString() : ''}</small></div><b>{displayStatus(registration.status)}</b>{registration.status === 'registered' && <button className="icon-button danger" aria-label="Cancel registration" onClick={() => cancelEvent(registration.id)}><XCircle /></button>}</div>)}{!data.eventRegistrations.length && <div className="panel-empty-state"><CalendarDays /><strong>No event registrations yet</strong><p>Join conversations, workshops and community gatherings.</p></div>}</div></section>

        <section className="dashboard-panel full-width"><div className="panel-heading"><div><span className="eyebrow">Giving and receipts</span><h2>Your impact records</h2></div><Link className="button ghost" to="/donate">Make another donation</Link></div><div className="impact-record-grid"><div><strong>{data.donations.length}</strong><span>Donation records</span></div><div><strong>{data.recurringDonations.filter((row) => row.status === 'active').length}</strong><span>Active recurring</span></div><div><strong>{data.volunteerApplications.length}</strong><span>Volunteer applications</span></div><div><strong>{data.assistanceRequests.length}</strong><span>Assistance requests</span></div></div>{data.donations.length > 0 && <div className="table-scroll professional-table"><table><thead><tr><th>Date</th><th>Receipt</th><th>Designation</th><th>Amount</th><th>Status</th></tr></thead><tbody>{data.donations.map((donation) => <tr key={donation.id}><td>{new Date(donation.created_at).toLocaleDateString()}</td><td>{donation.receipt_token ? <Link className="text-link" to={`/receipt/${donation.receipt_token}`}>{donation.receipt_number || 'View'}</Link> : 'Pending'}</td><td>{donation.designation}</td><td>{String(donation.currency).toUpperCase()} {Number(donation.amount).toLocaleString()}</td><td><span className={`status-pill ${donation.payment_status}`}>{displayStatus(donation.payment_status)}</span></td></tr>)}</tbody></table></div>}{data.recurringDonations.length > 0 && <div className="recurring-list"><h3>Recurring donations</h3>{data.recurringDonations.map((row) => <div key={row.id}><span>{String(row.currency).toUpperCase()} {Number(row.amount).toLocaleString()} / {row.interval}</span><b>{displayStatus(row.status)}</b>{row.status === 'active' && <button className="button ghost" onClick={() => cancelRecurring(row.id)}>Cancel</button>}</div>)}</div>}</section>

        <section className="dashboard-panel full-width"><div className="panel-heading"><div><span className="eyebrow">Communication</span><h2>Notification preferences</h2></div><Bell /></div><form className="preference-grid" onSubmit={savePreferences}><Preference name="transactionalEmail" label="Essential account emails" checked={data.notificationPreferences.transactional_email} disabled /><Preference name="donationUpdates" label="Donation and receipt updates" checked={data.notificationPreferences.donation_updates} /><Preference name="applicationUpdates" label="Application status updates" checked={data.notificationPreferences.application_updates} /><Preference name="eventReminders" label="Event reminders" checked={data.notificationPreferences.event_reminders} /><Preference name="newsletter" label="Network newsletter" checked={data.notificationPreferences.newsletter} /><button className="button"><Save size={16} />Save preferences</button></form></section>
      </div>
    </div>
  </section>;
}

function Preference({ name, label, checked, disabled = false }: { name: string; label: string; checked: boolean; disabled?: boolean }) {
  return <label className="preference-option"><input type="checkbox" name={name} defaultChecked={checked} disabled={disabled} /><span><b>{label}</b>{disabled && <small>Required for security and transaction notices.</small>}</span></label>;
}
