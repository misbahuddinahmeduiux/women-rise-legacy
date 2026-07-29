import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, UserCheck, Users, XCircle } from 'lucide-react';
import { ErrorBox, Loader, SuccessBox } from '../components/UI';
import { Seo } from '../components/Seo';
import { api } from '../lib/api';

type MentorDashboardData = { profile: any; matches: any[]; sessions: any[] };

export default function MentorDashboard() {
  const [data, setData] = useState<MentorDashboardData | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = () => api<MentorDashboardData>('/phase4/mentor-dashboard').then(setData).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, []);

  async function updateMatch(id: string, status: 'active' | 'declined') {
    try { await api(`/phase4/mentor-matches/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setMessage(status === 'active' ? 'Mentorship match accepted.' : 'Mentorship match declined.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Match could not be updated.'); }
  }

  async function updateSession(id: string, status: 'completed' | 'cancelled' | 'no_show') {
    const mentorPrivateNotes = status === 'completed' ? window.prompt('Optional private mentor notes:') || '' : '';
    try { await api(`/phase4/mentor-sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ status, mentorPrivateNotes }) }); setMessage('Session updated.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Session could not be updated.'); }
  }

  if (error && !data) return <div className="page-center"><ErrorBox message={error} /></div>;
  if (!data) return <Loader />;
  return <section className="dashboard-page"><Seo title="Mentor Dashboard" description="Manage Women Rise Legacy mentorship matches and sessions." noIndex /><div className="container">
    <div className="dashboard-welcome"><div><span className="eyebrow">Mentor Center</span><h1>Welcome, {data.profile.full_name || 'Mentor'}</h1><p>Review assigned members, accept matches, and manage upcoming sessions.</p></div><span className="membership-chip elite"><UserCheck />Verified mentor</span></div>
    {message && <SuccessBox message={message} />}{error && <ErrorBox message={error} />}
    <div className="dashboard-stats"><div><Users /><strong>{data.matches.length}</strong><span>Total matches</span></div><div><UserCheck /><strong>{data.matches.filter((m) => m.status === 'active').length}</strong><span>Active mentees</span></div><div><CalendarClock /><strong>{data.sessions.filter((s) => s.status === 'scheduled').length}</strong><span>Upcoming sessions</span></div></div>
    <div className="dashboard-grid">
      <section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">Assigned members</span><h2>Mentorship matches</h2></div></div><div className="mentor-match-list">{data.matches.map((match) => <article key={match.id}><img src={match.member?.avatar_url || '/assets/brand/logo-mark.webp'} alt="" /><div><h3>{match.member?.full_name || 'Member'}</h3><p>{match.member?.headline || match.goals || 'Women Rise Legacy member'}</p><small>{match.priority} priority · {match.status}</small></div>{match.status === 'pending_mentor' && <div className="record-actions"><button className="button" onClick={() => updateMatch(match.id, 'active')}><CheckCircle2 />Accept</button><button className="button ghost" onClick={() => updateMatch(match.id, 'declined')}><XCircle />Decline</button></div>}</article>)}{!data.matches.length && <p>No mentorship matches have been assigned yet.</p>}</div></section>
      <section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">Schedule</span><h2>Mentor sessions</h2></div></div><div className="mentor-session-list">{data.sessions.map((session) => <article key={session.id}><CalendarClock /><div><h3>{session.match?.member?.full_name || 'Mentorship session'}</h3><p>{new Date(session.scheduled_at).toLocaleString()} · {session.duration_minutes} minutes</p><small>{session.agenda || 'Session agenda will be shared by the admin.'}</small>{session.meeting_url && <a className="text-link" href={session.meeting_url} target="_blank" rel="noreferrer">Open meeting link</a>}</div><span className={`payment-status ${session.status === 'completed' ? 'paid' : session.status === 'scheduled' ? 'pending' : 'cancelled'}`}>{session.status}</span>{session.status === 'scheduled' && <div className="session-actions"><button className="icon-button" title="Mark completed" onClick={() => updateSession(session.id, 'completed')}><CheckCircle2 /></button><button className="icon-button danger" title="Cancel" onClick={() => updateSession(session.id, 'cancelled')}><XCircle /></button><button className="icon-button" title="Mark no-show" onClick={() => updateSession(session.id, 'no_show')}><Clock3 /></button></div>}</article>)}{!data.sessions.length && <p>No sessions have been scheduled yet.</p>}</div></section>
    </div>
  </div></section>;
}
