import { useEffect, useState } from 'react';
import {
  ArrowRight, BadgeCheck, CalendarClock, CheckCircle2, Clock3, MessageSquareText,
  Sparkles, Target, UserCheck, Users, XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorBox, Loader, SuccessBox } from '../components/UI';
import { Seo } from '../components/Seo';
import { api } from '../lib/api';

type MentorDashboardData = { profile: any; matches: any[]; sessions: any[] };

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MentorDashboard() {
  const [data, setData] = useState<MentorDashboardData | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = () => api<MentorDashboardData>('/phase4/mentor-dashboard').then(setData).catch((requestError) => setError(requestError.message));
  useEffect(() => { void load(); }, []);

  async function updateMatch(id: string, status: 'active' | 'declined') {
    setError('');
    try {
      await api(`/phase4/mentor-matches/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMessage(status === 'active' ? 'Mentorship match accepted.' : 'Mentorship match declined.'); await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Match could not be updated.'); }
  }

  async function updateSession(id: string, status: 'completed' | 'cancelled' | 'no_show') {
    const mentorPrivateNotes = status === 'completed' ? window.prompt('Optional private mentor notes:') || '' : '';
    setError('');
    try {
      await api(`/phase4/mentor-sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ status, mentorPrivateNotes }) });
      setMessage('Session updated.'); await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Session could not be updated.'); }
  }

  if (error && !data) return <div className="page-center"><ErrorBox message={error} /></div>;
  if (!data) return <Loader />;

  const pendingMatches = data.matches.filter((match) => match.status === 'pending_mentor');
  const activeMatches = data.matches.filter((match) => match.status === 'active');
  const upcomingSessions = data.sessions
    .filter((session) => session.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const completedSessions = data.sessions.filter((session) => session.status === 'completed');
  const nextSession = upcomingSessions[0];
  const availability = data.profile.mentor_availability || 'Availability not published';
  const expertise: string[] = data.profile.mentor_expertise || [];

  return <section className="dashboard-page mentor-dashboard-v2">
    <Seo title="Mentor Dashboard" description="Manage Women Rise Legacy mentorship matches and sessions." noIndex />
    <div className="container mentor-dashboard-container">
      <header className="mentor-command-hero">
        <div>
          <span className="mentor-kicker"><BadgeCheck />Verified mentor workspace</span>
          <h1>Welcome, {data.profile.full_name || 'Mentor'}.</h1>
          <p>Manage new requests, active mentees, upcoming sessions and the guidance you are contributing to the network.</p>
          <div className="mentor-hero-actions"><Link to="/mentors" className="mentor-secondary-action">View public mentor directory<ArrowRight /></Link><Link to="/dashboard" className="mentor-secondary-action">Member dashboard</Link>{data.profile.role === 'admin' && <Link to="/admin" className="mentor-secondary-action">Admin workspace</Link>}</div>
        </div>
        <div className="mentor-next-session-card">
          <span><CalendarClock />Next session</span>
          {nextSession ? <><strong>{nextSession.match?.member?.full_name || 'Mentorship session'}</strong><p>{new Date(nextSession.scheduled_at).toLocaleString()}</p><small>{nextSession.duration_minutes} minutes · {nextSession.agenda || 'Agenda pending'}</small>{nextSession.meeting_url && <a href={nextSession.meeting_url} target="_blank" rel="noreferrer">Open meeting link<ArrowRight /></a>}</> : <><strong>No session scheduled</strong><p>Your next confirmed session will appear here.</p></>}
        </div>
      </header>

      {message && <SuccessBox message={message} />}{error && <ErrorBox message={error} />}

      <div className="mentor-stat-grid">
        <article><span><Users /></span><div><small>Total matches</small><strong>{data.matches.length}</strong><b>All assigned relationships</b></div></article>
        <article><span><UserCheck /></span><div><small>Active mentees</small><strong>{activeMatches.length}</strong><b>Current mentoring relationships</b></div></article>
        <article><span><CalendarClock /></span><div><small>Upcoming</small><strong>{upcomingSessions.length}</strong><b>Scheduled sessions</b></div></article>
        <article><span><CheckCircle2 /></span><div><small>Completed</small><strong>{completedSessions.length}</strong><b>Sessions delivered</b></div></article>
      </div>

      <section className="mentor-profile-summary">
        <div><span className="eyebrow">Mentor profile</span><h2>Your expertise and availability</h2><p>Keep your member profile current so the team can make relevant, responsible matches.</p></div>
        <div className="mentor-profile-details"><span><Clock3 />{availability}</span><div className="tag-row">{expertise.length ? expertise.map((topic: string) => <span key={topic}>{topic}</span>) : <span>Expertise not added</span>}</div></div>
        <Link className="button ghost" to="/dashboard#profile">Edit profile</Link>
      </section>

      <div className="mentor-dashboard-grid">
        <section className="mentor-work-panel pending-panel">
          <div className="mentor-panel-heading"><div><span className="eyebrow">Needs your response</span><h2>New mentorship requests</h2></div><span className={pendingMatches.length ? 'mentor-count warning' : 'mentor-count'}>{pendingMatches.length}</span></div>
          <div className="mentor-match-list professional-mentor-list">{pendingMatches.map((match) => <article key={match.id}><img src={match.member?.avatar_url || '/assets/brand/logo-mark.webp'} alt="" /><div><h3>{match.member?.full_name || 'Member'}</h3><p>{match.member?.headline || match.goals || 'Women Rise Legacy member'}</p><small><Target />{match.goals || 'Goals will be discussed after acceptance'}</small><span>{statusLabel(match.priority || 'normal')} priority</span></div><div className="record-actions"><button className="button" onClick={() => updateMatch(match.id, 'active')}><CheckCircle2 />Accept</button><button className="button ghost" onClick={() => updateMatch(match.id, 'declined')}><XCircle />Decline</button></div></article>)}{!pendingMatches.length && <div className="panel-empty-state"><CheckCircle2 /><strong>You are up to date</strong><p>No mentorship requests are waiting for your response.</p></div>}</div>
        </section>

        <section className="mentor-work-panel">
          <div className="mentor-panel-heading"><div><span className="eyebrow">Current relationships</span><h2>Active mentees</h2></div><span className="mentor-count">{activeMatches.length}</span></div>
          <div className="mentor-match-list professional-mentor-list">{activeMatches.map((match) => <article key={match.id}><img src={match.member?.avatar_url || '/assets/brand/logo-mark.webp'} alt="" /><div><h3>{match.member?.full_name || 'Member'}</h3><p>{match.member?.headline || 'Women Rise Legacy member'}</p><small><Target />{match.goals || 'Mentorship goals not recorded'}</small><span>{statusLabel(match.status)}</span></div></article>)}{!activeMatches.length && <div className="panel-empty-state"><Users /><strong>No active mentees yet</strong><p>Accepted mentorship relationships will appear here.</p></div>}</div>
        </section>

        <section className="mentor-work-panel mentor-sessions-panel full-width">
          <div className="mentor-panel-heading"><div><span className="eyebrow">Schedule</span><h2>Mentor sessions</h2></div><span className="mentor-count">{data.sessions.length}</span></div>
          <div className="mentor-session-list professional-session-list">{data.sessions.map((session) => <article key={session.id}><div className="session-date-block"><strong>{new Date(session.scheduled_at).getDate()}</strong><span>{new Date(session.scheduled_at).toLocaleDateString('en-US', { month: 'short' })}</span></div><div><h3>{session.match?.member?.full_name || 'Mentorship session'}</h3><p>{new Date(session.scheduled_at).toLocaleString()} · {session.duration_minutes} minutes</p><small><MessageSquareText />{session.agenda || 'Session agenda will be shared by the admin.'}</small>{session.meeting_url && <a className="text-link" href={session.meeting_url} target="_blank" rel="noreferrer">Open meeting link</a>}</div><span className={`payment-status ${session.status === 'completed' ? 'paid' : session.status === 'scheduled' ? 'pending' : 'cancelled'}`}>{statusLabel(session.status)}</span>{session.status === 'scheduled' && <div className="session-actions"><button className="icon-button" title="Mark completed" onClick={() => updateSession(session.id, 'completed')}><CheckCircle2 /></button><button className="icon-button danger" title="Cancel" onClick={() => updateSession(session.id, 'cancelled')}><XCircle /></button><button className="icon-button" title="Mark no-show" onClick={() => updateSession(session.id, 'no_show')}><Clock3 /></button></div>}</article>)}{!data.sessions.length && <div className="panel-empty-state"><CalendarClock /><strong>No sessions scheduled</strong><p>Confirmed mentorship sessions will appear in this workspace.</p></div>}</div>
        </section>

        <section className="mentor-impact-callout full-width"><Sparkles /><div><span className="eyebrow">Mentor impact</span><h2>Your experience is creating somebody else’s next chapter.</h2><p>Keep session statuses and private notes current so the network can support every mentorship relationship responsibly.</p></div></section>
      </div>
    </div>
  </section>;
}
