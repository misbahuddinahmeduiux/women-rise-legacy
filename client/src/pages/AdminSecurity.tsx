import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck, BriefcaseBusiness, Check, ChevronRight, CircleAlert, Crown, Eye,
  KeyRound, LockKeyhole, Mail, Pencil, Plus, Search, ShieldCheck, UserRoundCheck,
  Users, X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBox, Loader, SuccessBox } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
type PermissionMode = 'additive' | 'replace';
type StaffStatus = 'invited' | 'active' | 'suspended' | 'deactivated';

type StaffRole = {
  key: string;
  name: string;
  description?: string | null;
  permissions: string[];
  is_super_admin: boolean;
};

type StaffRow = {
  user_id: string;
  role_key: string;
  permission_mode?: PermissionMode;
  custom_permissions: string[];
  effective_permissions?: string[];
  status: StaffStatus;
  job_title?: string | null;
  department?: string | null;
  invited_at?: string | null;
  role?: StaffRole | null;
  profile?: { id: string; full_name?: string | null; email_normalized?: string | null; avatar_url?: string | null; account_status?: string | null } | null;
};

type StaffDraft = {
  fullName: string;
  email: string;
  roleKey: string;
  status: StaffStatus;
  jobTitle: string;
  department: string;
  permissionMode: PermissionMode;
  customPermissions: string[];
  reason: string;
};

type ReviewState = { kind: 'invite' | 'edit'; draft: StaffDraft; row?: StaffRow };

type MentorRow = {
  user_id: string;
  professional_title?: string | null;
  expertise?: string[];
  profile_status: string;
  is_active: boolean;
  directory_visible: boolean;
  profile?: { full_name?: string | null; email_normalized?: string | null; avatar_url?: string | null; country?: string | null; city?: string | null } | null;
};

type MemberRow = {
  id: string;
  full_name?: string | null;
  email_normalized?: string | null;
  membership_level?: string | null;
  membership_status: string;
  membership_expires_at?: string | null;
  account_status: string;
  is_permanent_super_admin?: boolean;
};

type InvitationRow = {
  id: string;
  email: string;
  status: string;
  invited_at: string;
  accepted_at?: string | null;
  expires_at: string;
  revoked_at?: string | null;
};

const PERMISSION_GROUPS = [
  { label: 'Dashboard', description: 'Admin overview and workspace entry.', permissions: ['view_overview'] },
  { label: 'Members', description: 'Member records, account status and paid membership.', permissions: ['view_members', 'manage_members', 'manage_memberships'] },
  { label: 'Mentors', description: 'Mentor profiles, approvals and invitations.', permissions: ['view_mentors', 'manage_mentors', 'approve_mentors', 'manage_invitations'] },
  { label: 'Mentorship operations', description: 'Requests, applications, matching and sessions.', permissions: ['view_mentorship_requests', 'view_applications', 'manage_applications', 'manage_matches', 'manage_sessions'] },
  { label: 'Donations & reports', description: 'Donation operations, receipts and reporting.', permissions: ['manage_donations', 'view_reports'] },
  { label: 'Content & communication', description: 'Website content, submissions and email queue.', permissions: ['manage_content', 'manage_submissions', 'manage_email_queue'] },
  { label: 'Payments', description: 'Payment methods and payment administration.', permissions: ['manage_payments'] },
  { label: 'Team & permissions', description: 'Employees, roles and permission assignment.', permissions: ['manage_staff', 'assign_roles', 'assign_permissions'] },
  { label: 'Governance', description: 'Site settings and protected audit history.', permissions: ['manage_settings', 'view_audit'] }
] as const;

const PERMISSION_LABELS: Record<string, string> = {
  view_overview: 'View dashboard', view_members: 'View members', manage_members: 'Manage members', manage_memberships: 'Manage memberships',
  view_mentors: 'View mentors', manage_mentors: 'Manage mentors', approve_mentors: 'Approve mentors', manage_invitations: 'Manage invitations',
  view_mentorship_requests: 'View mentorship requests', view_applications: 'View applications', manage_applications: 'Manage applications',
  manage_matches: 'Manage matches', manage_sessions: 'Manage sessions', manage_donations: 'Manage donations', manage_submissions: 'Manage submissions',
  manage_content: 'Manage website content', manage_email_queue: 'Manage email queue', view_reports: 'View reports', manage_staff: 'Manage team',
  assign_roles: 'Assign roles', assign_permissions: 'Assign permissions', manage_settings: 'Manage settings', manage_payments: 'Manage payments', view_audit: 'View audit log'
};

function humanize(value?: string | null) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not set';
}

function unique(values: string[]) { return Array.from(new Set(values)); }

function rolePermissions(role: StaffRole | undefined, custom: string[], mode: PermissionMode) {
  if (role?.is_super_admin) return ['*'];
  return mode === 'replace' ? unique(custom) : unique([...(role?.permissions ?? []).filter((permission) => permission !== '*'), ...custom]);
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`security-status security-status-${value}`}>{humanize(value)}</span>;
}

function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId=useId();
  const dialogRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const previousFocus=document.activeElement as HTMLElement|null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';

    const dialog=dialogRef.current;
    const focusable=dialog?.querySelector<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])');
    window.setTimeout(()=>{(focusable||dialog)?.focus();},0);

    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if(event.key!=='Tab'||!dialog)return;
      const items=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')).filter((item)=>item.offsetParent!==null);
      if(!items.length){event.preventDefault();dialog.focus();return;}
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };

    document.addEventListener('keydown',onKeyDown);
    return()=>{
      document.removeEventListener('keydown',onKeyDown);
      document.body.style.overflow=previousOverflow;
      previousFocus?.focus();
    };
  },[onClose]);

  return <div className="modal-backdrop security-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} tabIndex={-1} className={`admin-modal security-modal ${wide ? 'security-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="security-modal-header"><div className="security-modal-heading"><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="modal-close" type="button" aria-label="Close dialog" onClick={onClose}><X /></button></header>
      <div className="security-modal-body">{children}</div>
    </div>
  </div>;
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="security-empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>;
}

function Pager({ data, load }: { data: Page<unknown>; load: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <div className="security-pager">
    <button className="button ghost button-small" disabled={data.page <= 1} onClick={() => load(data.page - 1)}>Previous</button>
    <span>Page {data.page} of {pages} · {data.total} records</span>
    <button className="button ghost button-small" disabled={data.page >= pages} onClick={() => load(data.page + 1)}>Next</button>
  </div>;
}

function PermissionSelector({ selected, onChange, available }: { selected: string[]; onChange: (values: string[]) => void; available: string[] }) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const availableSet = useMemo(() => new Set(available), [available]);
  function toggle(permission: string) {
    onChange(selectedSet.has(permission) ? selected.filter((item) => item !== permission) : [...selected, permission]);
  }
  function toggleGroup(group: readonly string[]) {
    const usable = group.filter((permission) => availableSet.has(permission));
    const everySelected = usable.every((permission) => selectedSet.has(permission));
    onChange(everySelected ? selected.filter((permission) => !usable.includes(permission)) : unique([...selected, ...usable]));
  }
  return <div className="permission-matrix">
    {PERMISSION_GROUPS.map((group) => {
      const usable = group.permissions.filter((permission) => availableSet.has(permission));
      if (!usable.length) return null;
      const allSelected = usable.every((permission) => selectedSet.has(permission));
      return <section className="permission-group" key={group.label}>
        <header><div><strong>{group.label}</strong><small>{group.description}</small></div><button type="button" onClick={() => toggleGroup(usable)}>{allSelected ? 'Clear group' : 'Select group'}</button></header>
        <div>{usable.map((permission) => <label key={permission} className={selectedSet.has(permission) ? 'selected' : ''}><input type="checkbox" checked={selectedSet.has(permission)} onChange={() => toggle(permission)} /><span><Check />{PERMISSION_LABELS[permission] ?? humanize(permission)}</span></label>)}</div>
      </section>;
    })}
  </div>;
}

export function SecureMembersAdmin() {
  const [data, setData] = useState<Page<MemberRow> | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [membershipMember, setMembershipMember] = useState<MemberRow | null>(null);
  const [accountMember, setAccountMember] = useState<MemberRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (page = 1) => {
    setError('');
    api<Page<MemberRow>>(`/admin/security/members?page=${page}&pageSize=25&search=${encodeURIComponent(search)}`).then(setData).catch((requestError) => setError(requestError.message));
  };
  useEffect(() => { void load(); }, []);

  async function saveMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!membershipMember) return;
    const fd = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      const expiresAt = String(fd.get('expiresAt') || '');
      await api(`/admin/security/members/${membershipMember.id}/membership`, { method: 'PATCH', body: JSON.stringify({
        membershipStatus: fd.get('membershipStatus'), membershipLevel: fd.get('membershipLevel') || null,
        membershipExpiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null, reason: fd.get('reason')
      }) });
      setMessage('Personal membership updated. Staff and mentor access were not changed.'); setMembershipMember(null); void load(data?.page ?? 1);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Membership could not be updated.'); }
    finally { setBusy(false); }
  }

  async function saveAccountStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!accountMember) return;
    const fd = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      await api(`/admin/security/members/${accountMember.id}/account-status`, { method: 'PATCH', body: JSON.stringify({ status: fd.get('status'), reason: fd.get('reason') }) });
      setMessage('Member account status updated and audit logged.'); setAccountMember(null); void load(data?.page ?? 1);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Account status could not be updated.'); }
    finally { setBusy(false); }
  }

  return <div className="admin-content security-admin-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Member accounts</span><h1>Members</h1><p>Personal membership, mentor profiles and staff authority remain separate. Updating a paid plan here never grants admin or mentor access.</p></div></div>
    {error && <ErrorBox message={error} />}{message && <SuccessBox message={message} />}
    <form className="security-toolbar" onSubmit={(event) => { event.preventDefault(); void load(1); }}><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, city or country" /></label><button className="button button-small">Search</button></form>
    {!data ? <Loader /> : data.items.length ? <div className="admin-table-wrap security-table-wrap"><table><thead><tr><th>Member</th><th>Personal membership</th><th>Account</th><th>Actions</th></tr></thead><tbody>{data.items.map((row) => <tr key={row.id}><td><strong>{row.full_name || 'Unnamed member'}</strong><small>{row.email_normalized || 'No email available'}</small>{row.is_permanent_super_admin && <span className="security-self-badge"><LockKeyhole />Permanent Super Admin</span>}</td><td><strong>{row.membership_level ? humanize(row.membership_level) : 'No personal plan'}</strong><small>{humanize(row.membership_status)}{row.membership_expires_at ? ` · until ${new Date(row.membership_expires_at).toLocaleDateString()}` : ''}</small></td><td><StatusBadge value={row.account_status} /></td><td><div className="security-row-actions"><button className="button ghost button-small" onClick={() => setMembershipMember(row)}><Crown />Personal membership</button>{row.is_permanent_super_admin ? <span className="security-locked-label"><LockKeyhole />Account protected</span> : <button className="button ghost button-small" onClick={() => setAccountMember(row)}><KeyRound />Account</button>}</div></td></tr>)}</tbody></table></div> : <EmptyState icon={<Users />} title="No members found" text="Try another search term." />}
    {data && <Pager data={data} load={load} />}
    {membershipMember && <Modal title="Edit personal membership" subtitle="This does not change staff authority or mentor status." onClose={() => setMembershipMember(null)}><form className="security-form" onSubmit={saveMembership}><label>Membership level<select name="membershipLevel" defaultValue={membershipMember.membership_level || ''}><option value="">No personal plan</option><option value="rise">Rise</option><option value="legacy">Legacy</option><option value="elite">Elite</option></select></label><label>Membership status<select name="membershipStatus" defaultValue={membershipMember.membership_status}><option value="inactive">Inactive</option><option value="pending">Pending</option><option value="trialing">Trialing</option><option value="active">Active</option><option value="past_due">Past due</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></label><label>Expires on<input type="date" name="expiresAt" defaultValue={membershipMember.membership_expires_at?.slice(0, 10) || ''} /></label><label className="wide">Audit reason<textarea name="reason" rows={3} required placeholder="Why is this membership being changed?" /></label><div className="security-form-actions"><button type="button" className="button ghost" onClick={() => setMembershipMember(null)}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save membership'}</button></div></form></Modal>}
    {accountMember && <Modal title="Change member account status" onClose={() => setAccountMember(null)}><form className="security-form" onSubmit={saveAccountStatus}><label>Account status<select name="status" defaultValue={accountMember.account_status}><option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select></label><label className="wide">Audit reason<textarea name="reason" rows={3} required /></label><div className="security-form-actions"><button type="button" className="button ghost" onClick={() => setAccountMember(null)}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Confirm status'}</button></div></form></Modal>}
  </div>;
}

export function MentorsAdmin() {
  const { user, access, refreshAccess } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Page<MentorRow> | null>(null);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false); const [review, setReview] = useState<{ row: MentorRow; decision: string } | null>(null); const [busy, setBusy] = useState(false);
  const load = (page = 1) => api<Page<MentorRow>>(`/admin/security/mentors?page=${page}&pageSize=25&search=${encodeURIComponent(search)}`).then(setData).catch((requestError) => setError(requestError.message));
  useEffect(() => { void load(); }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fd = new FormData(event.currentTarget); setBusy(true); setError('');
    try { await api('/admin/security/mentor-invitations', { method: 'POST', body: JSON.stringify({ fullName: fd.get('fullName'), email: fd.get('email'), professionalTitle: fd.get('professionalTitle'), expertise: String(fd.get('expertise') || '').split(',').map((value) => value.trim()).filter(Boolean) }) }); setMessage('Mentor invitation sent. No staff or paid membership access was created.'); setInviteOpen(false); void load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Invitation failed.'); } finally { setBusy(false); }
  }

  async function addMyself() {
    setBusy(true); setError('');
    try { const result = await api<{ message: string }>('/admin/security/mentors/self', { method: 'POST' }); setMessage(result.message); await refreshAccess(); navigate('/mentor-onboarding'); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Mentor profile could not be created.'); } finally { setBusy(false); }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!review) return; const fd = new FormData(event.currentTarget); setBusy(true); setError('');
    try { await api(`/admin/security/mentors/${review.row.user_id}/review`, { method: 'PATCH', body: JSON.stringify({ decision: review.decision, reason: fd.get('reason'), directoryVisible: fd.get('directoryVisible') === 'on' }) }); setMessage(review.row.user_id === user?.id && review.decision === 'approve' ? 'Your mentor profile was self-approved and audit logged.' : `Mentor ${review.decision} completed and audit logged.`); setReview(null); await refreshAccess(); void load(data?.page ?? 1); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Mentor review failed.'); } finally { setBusy(false); }
  }

  return <div className="admin-content security-admin-page">
    <div className="admin-page-heading security-heading-actions"><div><span className="eyebrow">Mentor lifecycle</span><h1>Mentors</h1><p>Mentors are separate from employees and paid members. Only completed, approved and active mentor profiles may appear publicly.</p></div><div>{access?.isSuperAdmin && !access.mentorStatus && <button className="button secondary" disabled={busy} onClick={addMyself}><UserRoundCheck />Add myself as mentor</button>}{access?.mentorStatus && <Link className="button secondary" to={access.mentorStatus === 'approved' && access.mentorActive ? '/mentor-dashboard' : '/mentor-onboarding'}><UserRoundCheck />My mentor profile</Link>}<button className="button" onClick={() => setInviteOpen(true)}><Plus />Invite mentor</button></div></div>
    {access?.isSuperAdmin && <div className="security-separation-note"><ShieldCheck /><div><strong>Permanent Super Admin and mentor are independent.</strong><p>Adding yourself as a mentor creates only a mentor profile. It does not create or change a paid membership. Because there is one permanent Super Admin, your completed profile may be self-approved with a permanent audit record.</p></div></div>}
    {error && <ErrorBox message={error} />}{message && <SuccessBox message={message} />}
    <form className="security-toolbar" onSubmit={(event) => { event.preventDefault(); void load(1); }}><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search mentor name or email" /></label><button className="button button-small">Search</button></form>
    {!data ? <Loader /> : data.items.length ? <div className="security-card-list">{data.items.map((row) => { const isSelf = row.user_id === user?.id; return <article className="security-person-card" key={row.user_id}><div className="security-person-avatar"><img src={row.profile?.avatar_url || '/assets/brand/logo-mark.webp'} alt="" /></div><div className="security-person-main"><div className="security-person-title"><h3>{row.profile?.full_name || 'Unnamed mentor'}</h3>{isSelf && <span className="security-self-badge"><Crown />You</span>}<StatusBadge value={row.profile_status} /></div><p>{row.professional_title || row.profile?.email_normalized || 'Professional title not completed'}</p><small>{row.expertise?.length ? row.expertise.join(' · ') : 'Expertise not completed'} · Directory {row.directory_visible ? 'visible' : 'hidden'}</small></div><div className="security-row-actions">{row.profile_status === 'pending_approval' && <><button className="button button-small" onClick={() => setReview({ row, decision: 'approve' })}><BadgeCheck />{isSelf ? 'Approve my profile' : 'Approve'}</button><button className="button ghost button-small" onClick={() => setReview({ row, decision: 'reject' })}>Reject</button></>}{row.profile_status === 'approved' && <button className="button ghost button-small" onClick={() => setReview({ row, decision: 'suspend' })}>Suspend</button>}{row.profile_status === 'suspended' && <button className="button button-small" onClick={() => setReview({ row, decision: 'reactivate' })}>Reactivate</button>}{['rejected', 'deactivated', 'profile_incomplete', 'invited'].includes(row.profile_status) && isSelf && <Link className="button ghost button-small" to="/mentor-onboarding"><Pencil />Complete profile</Link>}</div></article>; })}</div> : <EmptyState icon={<UserRoundCheck />} title="No mentors found" text="Invite a mentor or adjust your search." />}
    {data && <Pager data={data} load={load} />}
    {inviteOpen && <Modal title="Invite a mentor" subtitle="This creates a mentor invitation only—never employee permissions or paid membership." onClose={() => setInviteOpen(false)}><form className="security-form" onSubmit={invite}><label>Full name<input name="fullName" required /></label><label>Email<input name="email" type="email" required /></label><label>Professional title<input name="professionalTitle" /></label><label className="wide">Expertise, comma separated<textarea name="expertise" rows={3} placeholder="Leadership, finance, career strategy" /></label><div className="security-form-actions"><button type="button" className="button ghost" onClick={() => setInviteOpen(false)}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Sending…' : 'Send secure invitation'}</button></div></form></Modal>}
    {review && <Modal title={`${humanize(review.decision)} mentor`} subtitle={review.row.user_id === user?.id && review.decision === 'approve' ? 'This self-approval is allowed only for the permanent Super Admin and will be audit logged.' : 'This sensitive action will be stored in the protected audit log.'} onClose={() => setReview(null)}><form className="security-form" onSubmit={submitReview}>{['approve', 'reactivate'].includes(review.decision) && <label className="security-check wide"><input name="directoryVisible" type="checkbox" defaultChecked /><span><Eye />Show in the public mentor directory after activation</span></label>}<label className="wide">Audit reason<textarea name="reason" rows={4} required={review.decision !== 'approve'} defaultValue={review.decision === 'approve' ? (review.row.user_id === user?.id ? 'Permanent Super Admin approved their own completed mentor profile.' : 'Approved after completed profile review.') : ''} /></label><div className="security-form-actions"><button type="button" className="button ghost" onClick={() => setReview(null)}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Saving…' : `Confirm ${review.decision}`}</button></div></form></Modal>}
  </div>;
}

export function InvitationsAdmin() {
  const [data, setData] = useState<Page<InvitationRow> | null>(null); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [revoking, setRevoking] = useState<InvitationRow | null>(null); const [busy, setBusy] = useState(false);
  const load = (page = 1) => api<Page<InvitationRow>>(`/admin/security/mentor-invitations?page=${page}&pageSize=25`).then(setData).catch((requestError) => setError(requestError.message));
  useEffect(() => { void load(); }, []);
  async function revoke(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!revoking) return; const fd = new FormData(event.currentTarget); setBusy(true); setError(''); try { await api(`/admin/security/mentor-invitations/${revoking.id}/revoke`, { method: 'POST', body: JSON.stringify({ reason: fd.get('reason') }) }); setMessage('Invitation revoked and audit logged.'); setRevoking(null); void load(data?.page ?? 1); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Revoke failed.'); } finally { setBusy(false); } }
  return <div className="admin-content security-admin-page"><div className="admin-page-heading"><div><span className="eyebrow">Invitation tracking</span><h1>Mentor invitations</h1><p>Track invitation, acceptance and review status without mixing mentors into the employee team.</p></div></div>{error && <ErrorBox message={error} />}{message && <SuccessBox message={message} />}{!data ? <Loader /> : data.items.length ? <div className="admin-table-wrap security-table-wrap"><table><thead><tr><th>Email</th><th>Status</th><th>Invited</th><th>Expires</th><th>Action</th></tr></thead><tbody>{data.items.map((row) => <tr key={row.id}><td><strong>{row.email}</strong>{row.accepted_at && <small>Accepted {new Date(row.accepted_at).toLocaleString()}</small>}</td><td><StatusBadge value={row.status} /></td><td>{new Date(row.invited_at).toLocaleString()}</td><td>{new Date(row.expires_at).toLocaleString()}</td><td>{['invited', 'accepted', 'profile_incomplete', 'pending_approval'].includes(row.status) ? <button className="button ghost button-small" onClick={() => setRevoking(row)}>Revoke</button> : <span className="security-muted">No action</span>}</td></tr>)}</tbody></table></div> : <EmptyState icon={<Mail />} title="No mentor invitations" text="New mentor invitations will appear here." />}{data && <Pager data={data} load={load} />}{revoking && <Modal title="Revoke mentor invitation" subtitle={revoking.email} onClose={() => setRevoking(null)}><form className="security-form" onSubmit={revoke}><label className="wide">Audit reason<textarea name="reason" rows={4} required /></label><div className="security-form-actions"><button type="button" className="button ghost" onClick={() => setRevoking(null)}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Revoking…' : 'Confirm revoke'}</button></div></form></Modal>}</div>;
}

function StaffAccessForm({ roles, allPermissions, initial, invite, onCancel, onReview }: { roles: StaffRole[]; allPermissions: string[]; initial?: StaffRow; invite: boolean; onCancel: () => void; onReview: (draft: StaffDraft) => void }) {
  const initialRole = roles.find((role) => role.key === initial?.role_key) ?? roles[0];
  const initialMode = initial?.permission_mode ?? 'replace';
  const [fullName, setFullName] = useState(initial?.profile?.full_name || ''); const [email, setEmail] = useState(initial?.profile?.email_normalized || '');
  const [roleKey, setRoleKey] = useState(initialRole?.key || ''); const [status, setStatus] = useState<StaffStatus>(initial?.status || 'active');
  const [jobTitle, setJobTitle] = useState(initial?.job_title || ''); const [department, setDepartment] = useState(initial?.department || '');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(initialMode);
  const [customPermissions, setCustomPermissions] = useState<string[]>(initial ? (initial.custom_permissions || []) : (initialRole?.permissions || []).filter((permission) => permission !== '*'));
  const [reason, setReason] = useState('');
  const role = roles.find((item) => item.key === roleKey);
  const effective = rolePermissions(role, customPermissions, permissionMode);

  function changeRole(nextRoleKey: string) {
    setRoleKey(nextRoleKey); const nextRole = roles.find((item) => item.key === nextRoleKey);
    setCustomPermissions(permissionMode === 'replace' ? (nextRole?.permissions || []).filter((permission) => permission !== '*') : []);
  }

  function changeMode(nextMode: PermissionMode) {
    setPermissionMode(nextMode);
    if (nextMode === 'replace') setCustomPermissions((role?.permissions || []).filter((permission) => permission !== '*'));
    else setCustomPermissions([]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onReview({ fullName, email, roleKey, status, jobTitle, department, permissionMode, customPermissions, reason: invite ? 'New staff invitation' : reason });
  }

  return <form className="security-form security-staff-form" onSubmit={submit}>
    {invite && <><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label><label>Work email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label></>}
    <label>Staff role<select value={roleKey} onChange={(event) => changeRole(event.target.value)} required>{roles.map((item) => <option value={item.key} key={item.key}>{item.name}</option>)}</select><small>{role?.description}</small></label>
    {!invite && (initial?.status==='invited'
      ? <div className="security-invitation-state"><Mail /><span><b>Invitation pending</b><small>This record stays invited until the employee accepts it. Normal editing cannot reactivate or reset invitation state.</small></span></div>
      : <label>Access status<select value={status} onChange={(event) => setStatus(event.target.value as StaffStatus)}><option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select></label>)}
    <label>Job title<input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} /></label><label>Department<input value={department} onChange={(event) => setDepartment(event.target.value)} /></label>
    <fieldset className="security-access-mode wide"><legend>Module access method</legend><label className={permissionMode === 'additive' ? 'selected' : ''}><input type="radio" name="permissionMode" checked={permissionMode === 'additive'} onChange={() => changeMode('additive')} /><span><BriefcaseBusiness /><b>Use role defaults</b><small>The selected role controls access. Optional extras are currently cleared.</small></span></label><label className={permissionMode === 'replace' ? 'selected' : ''}><input type="radio" name="permissionMode" checked={permissionMode === 'replace'} onChange={() => changeMode('replace')} /><span><ShieldCheck /><b>Exact custom module access</b><small>Only the checked permissions will be active.</small></span></label></fieldset>
    {permissionMode === 'replace' && <div className="wide"><div className="security-permission-heading"><div><span className="eyebrow">Module permissions</span><h3>Select exact access</h3><p>{effective.length} permission{effective.length === 1 ? '' : 's'} selected.</p></div><button type="button" className="button ghost button-small" onClick={() => setCustomPermissions((role?.permissions || []).filter((permission) => permission !== '*'))}>Reset to role</button></div><PermissionSelector selected={customPermissions} onChange={setCustomPermissions} available={allPermissions} /></div>}
    {!invite && <label className="wide">Reason for change<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required placeholder="Required for the audit log" /></label>}
    <div className="security-form-actions wide"><button type="button" className="button ghost" onClick={onCancel}>Cancel</button><button className="button">Review changes<ChevronRight /></button></div>
  </form>;
}

export function TeamPermissionsAdmin() {
  const [data, setData] = useState<Page<StaffRow> | null>(null); const [roles, setRoles] = useState<StaffRole[]>([]); const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false); const [editing, setEditing] = useState<StaffRow | null>(null); const [review, setReview] = useState<ReviewState | null>(null); const [busy, setBusy] = useState(false);
  const assignableRoles = useMemo(() => roles.filter((role) => !role.is_super_admin), [roles]);

  const load = async (page = 1) => {
    setError('');
    try { const [team, roleData] = await Promise.all([api<Page<StaffRow>>(`/admin/security/team?page=${page}&pageSize=25&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`), api<{ roles: StaffRole[]; permissions: string[] }>('/admin/security/roles')]); setData(team); setRoles(roleData.roles); setPermissions(roleData.permissions); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Team could not be loaded.'); }
  };
  useEffect(() => { void load(); }, []);

  async function confirmReview() {
    if (!review) return; setBusy(true); setError('');
    try {
      const payload = { roleKey: review.draft.roleKey, jobTitle: review.draft.jobTitle, department: review.draft.department, permissionMode: review.draft.permissionMode, customPermissions: review.draft.customPermissions };
      if (review.kind === 'invite') await api('/admin/security/team/invite', { method: 'POST', body: JSON.stringify({ ...payload, fullName: review.draft.fullName, email: review.draft.email }) });
      else await api(`/admin/security/team/${review.row!.user_id}`, { method: 'PUT', body: JSON.stringify({ ...payload, status: review.draft.status, reason: review.draft.reason, confirmed: true }) });
      setMessage(review.kind === 'invite' ? 'Employee invitation created. No mentor profile or personal membership was created.' : 'Employee access updated and audit logged.'); setReview(null); setInviteOpen(false); setEditing(null); void load(data?.page ?? 1);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Staff access could not be saved.'); }
    finally { setBusy(false); }
  }

  const reviewRole = review ? roles.find((role) => role.key === review.draft.roleKey) : undefined;
  const reviewPermissions = review ? rolePermissions(reviewRole, review.draft.customPermissions, review.draft.permissionMode) : [];

  return <div className="admin-content security-admin-page">
    <div className="admin-page-heading security-heading-actions"><div><span className="eyebrow">Internal staff only</span><h1>Team &amp; Permissions</h1><p>There is one permanent Super Admin. Every Admin or employee receives only the modules selected here. Staff access never creates mentor or paid membership status.</p></div><button className="button" onClick={() => setInviteOpen(true)} disabled={!assignableRoles.length}><Plus />Add Admin or employee</button></div>
    <div className="security-separation-note"><LockKeyhole /><div><strong>Permanent Super Admin protection</strong><p>The existing Super Admin cannot be duplicated, edited, suspended, deactivated or replaced from this screen. All other team members use role defaults or exact module permissions.</p></div></div>
    {error && <ErrorBox message={error} />}{message && <SuccessBox message={message} />}
    <form className="security-toolbar security-toolbar-split" onSubmit={(event) => { event.preventDefault(); void load(1); }}><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, email, title or department" /></label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="invited">Invited</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select><button className="button button-small">Apply filters</button></form>
    {!data ? <Loader /> : data.items.length ? <div className="security-card-list">{data.items.map((row) => { const isPermanent = row.role_key === 'super_admin' || row.role?.is_super_admin; const effective = row.effective_permissions || rolePermissions(row.role || undefined, row.custom_permissions || [], row.permission_mode || 'additive'); return <article className={`security-person-card security-team-card ${isPermanent ? 'security-permanent-card' : ''}`} key={row.user_id}><div className="security-person-avatar"><img src={row.profile?.avatar_url || '/assets/brand/logo-mark.webp'} alt="" />{isPermanent && <span><Crown /></span>}</div><div className="security-person-main"><div className="security-person-title"><h3>{row.profile?.full_name || row.profile?.email_normalized || 'Unnamed team member'}</h3><StatusBadge value={row.status} />{isPermanent && <span className="security-self-badge"><LockKeyhole />Permanent</span>}</div><p>{row.role?.name || humanize(row.role_key)} · {row.job_title || 'No job title'}{row.department ? ` · ${row.department}` : ''}</p><small>{row.profile?.email_normalized || 'No email'} · {isPermanent ? 'Full platform authority' : row.permission_mode === 'replace' ? 'Exact custom module access' : 'Role default access'}</small><div className="security-permission-summary">{effective.slice(0, 6).map((permission) => <span key={permission}>{permission === '*' ? 'All modules' : PERMISSION_LABELS[permission] || humanize(permission)}</span>)}{effective.length > 6 && <span>+{effective.length - 6} more</span>}{!effective.length && <span>No module access</span>}</div></div><div className="security-row-actions">{isPermanent ? <span className="security-locked-label"><LockKeyhole />Protected account</span> : <button className="button ghost button-small" onClick={() => setEditing(row)}><Pencil />Edit access</button>}</div></article>; })}</div> : <EmptyState icon={<Users />} title="No team members found" text="Adjust the filters or add an employee." />}
    {data && <Pager data={data} load={load} />}
    {inviteOpen && <Modal title="Add Admin or employee" subtitle="Choose a role and then set exact module access where required." onClose={() => setInviteOpen(false)} wide><StaffAccessForm roles={assignableRoles} allPermissions={permissions} invite onCancel={() => setInviteOpen(false)} onReview={(draft) => { setInviteOpen(false); setReview({ kind: 'invite', draft }); }} /></Modal>}
    {editing && <Modal title="Edit employee access" subtitle={`${editing.profile?.full_name || editing.profile?.email_normalized || 'Team member'} · changes require review and an audit reason.`} onClose={() => setEditing(null)} wide><StaffAccessForm roles={assignableRoles} allPermissions={permissions} initial={editing} invite={false} onCancel={() => setEditing(null)} onReview={(draft) => { const row = editing; setEditing(null); if (row) setReview({ kind: 'edit', draft, row }); }} /></Modal>}
    {review && <Modal title="Confirm staff access" subtitle="Review the effective permissions before saving." onClose={() => setReview(null)} wide><div className="security-review-card"><div><small>Team member</small><strong>{review.draft.fullName || review.row?.profile?.full_name || review.draft.email}</strong></div><div><small>Role</small><strong>{reviewRole?.name || review.draft.roleKey}</strong></div><div><small>Status</small><strong>{review.kind === 'invite' ? 'Invitation / active existing account' : humanize(review.draft.status)}</strong></div><div><small>Access method</small><strong>{review.draft.permissionMode === 'replace' ? 'Exact custom modules' : 'Role defaults'}</strong></div></div><div className="security-review-permissions"><h3>Effective permissions ({reviewPermissions.length})</h3><div>{reviewPermissions.map((permission) => <span key={permission}>{PERMISSION_LABELS[permission] || humanize(permission)}</span>)}{!reviewPermissions.length && <span>No protected module access</span>}</div></div>{review.kind === 'edit' && <div className="security-audit-reason"><CircleAlert /><span><b>Audit reason</b>{review.draft.reason}</span></div>}<div className="security-form-actions"><button type="button" className="button ghost" onClick={() => setReview(null)}>Cancel</button><button className="button" disabled={busy} onClick={confirmReview}>{busy ? 'Saving…' : review.kind === 'invite' ? 'Confirm invitation' : 'Confirm access change'}</button></div></Modal>}
  </div>;
}
