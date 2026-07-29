import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CmsPageHero } from '../components/CmsPageHero';
import { FormInput, FormSelect, FormTextArea } from '../components/FormFields';
import { ErrorBox, SuccessBox } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { MemberProfile, MembershipPlan } from '../types';

export function MembershipApply() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { api<MembershipPlan[]>('/memberships/plans').then(setPlans).catch(() => undefined); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      await api('/network/membership-applications', { method: 'POST', body: JSON.stringify(Object.fromEntries(formData)) });
      setSuccess('Your membership goals have been submitted. Choose and pay for a plan to activate membership automatically; no separate admin approval is required after verified payment.');
      form.reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The membership form could not be submitted.');
    } finally { setLoading(false); }
  }

  const planOptions: [string, string][] = plans.length
    ? Array.from(new Map(plans.map((plan) => [plan.access_level, plan.name])).entries()) as [string, string][]
    : [['rise', 'Rise'], ['legacy', 'Legacy'], ['elite', 'Elite']];

  return <>
    <CmsPageHero contentKey="page.membership-apply" fallback={{
      seoTitle: 'Membership Goals',
      seoDescription: 'Share your goals before choosing a Women Rise Legacy membership plan.',
      eyebrow: 'Membership goals',
      title: 'Tell us where you are and where you want to grow',
      heroText: 'This optional form helps the team understand relevant resources and connections. Membership activates automatically after verified payment.'
    }}/>
    <section className="section"><div className="container form-shell">
      {success ? <><SuccessBox message={success}/><Link className="button" to="/membership">Choose a membership plan</Link></> : <form onSubmit={submit} className="form-grid">
        {error && <div className="full"><ErrorBox message={error}/></div>}
        <FormInput label="Full name" name="fullName" required defaultValue={user?.user_metadata?.full_name || ''}/>
        <FormInput label="Email" name="email" type="email" required defaultValue={user?.email || ''}/>
        <FormSelect label="Membership pathway" name="requestedLevel" required defaultValue={params.get('level') || planOptions[0]?.[0] || 'rise'} options={planOptions}/>
        <FormInput label="Current role or business" name="currentRole" required/>
        <FormTextArea label="What professional or personal goal are you working toward?" name="professionalGoal" required/>
        <FormTextArea label="How would you like to participate in the community?" name="communityInterest" required/>
        <label className="checkbox full"><input type="checkbox" name="consentConfirmed" value="true" required/>I agree to be contacted about membership and community opportunities.</label>
        <button className="button full" disabled={loading}>{loading ? 'Submitting…' : 'Submit goals'}</button>
      </form>}
    </div></section>
  </>;
}

export function MentorRequestForm() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [mentors, setMentors] = useState<MemberProfile[]>([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (user) api<MemberProfile[]>('/public/mentors').then(setMentors).catch(() => undefined); }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const result = await api<{ message: string }>('/network/mentor-requests', {
        method: 'POST',
        body: JSON.stringify({ mentorId: formData.get('mentorId') || '', preferredTopics: formData.get('preferredTopics'), goals: formData.get('goals'), availability: formData.get('availability') })
      });
      setSuccess(result.message || 'Your mentorship request has been submitted.');
      form.reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Mentorship request could not be submitted.');
    } finally { setLoading(false); }
  }

  return <>
    <CmsPageHero contentKey="page.mentor-request" fallback={{
      seoTitle: 'Request Mentorship',
      seoDescription: 'Legacy and Elite members can request guidance from Women Rise Legacy mentors.',
      eyebrow: 'Mentorship request',
      title: 'Ask for guidance with clarity and intention',
      heroText: 'Legacy members can submit mentorship requests. Elite members receive priority or private matching based on availability.'
    }}/>
    <section className="section"><div className="container form-shell">
      {!user ? <div className="empty"><h2>Member login required</h2><p>Sign in with an active Legacy or Elite membership to request mentorship.</p><div className="hero-actions"><Link className="button" to="/login">Member login</Link><Link className="button ghost" to="/membership">View membership plans</Link></div></div>
        : success ? <><SuccessBox message={success}/><Link className="button ghost" to="/mentors">Return to mentor directory</Link></>
        : <form onSubmit={submit} className="form-grid">
          {error && <div className="full"><ErrorBox message={error}/></div>}
          <FormSelect label="Preferred mentor" name="mentorId" defaultValue={params.get('mentor') || ''} options={[["", "Open to best match"], ...mentors.map((mentor) => [mentor.id, mentor.full_name || 'Mentor'] as [string, string])]}/>
          <FormInput label="Preferred topics" name="preferredTopics" required placeholder="Career transition, leadership, branding, funding…"/>
          <FormTextArea label="What would you like help achieving?" name="goals" required/>
          <FormInput label="Your availability" name="availability" required placeholder="Weekday evenings, Saturdays…"/>
          <button className="button full" disabled={loading}>{loading ? 'Submitting…' : 'Submit mentorship request'}</button>
        </form>}
    </div></section>
  </>;
}
