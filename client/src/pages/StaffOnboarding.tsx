import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ErrorBox, SuccessBox } from '../components/UI';
import { Seo } from '../components/Seo';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export default function StaffOnboarding(){
  const {access,accessLoading,refreshAccess}=useAuth();
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  if(!accessLoading&&access?.staffStatus==='active')return <Navigate to="/admin" replace/>;
  async function accept(){setBusy(true);setError('');try{const result=await api<{message:string}>('/access/staff-invitation/accept',{method:'POST'});setMessage(result.message);await refreshAccess()}catch(e){setError(e instanceof Error?e.message:'Team invitation could not be accepted.')}finally{setBusy(false)}}
  return <section className="section"><Seo title="Team Invitation" description="Accept your Women Rise Legacy staff invitation." noIndex/><div className="container narrow"><div className="card"><span className="eyebrow">Team & Permissions</span><h1>Accept your team invitation</h1><p>Accepting activates only the staff role and permissions assigned by an authorized administrator. It does not create or change a mentor profile.</p>{error&&<ErrorBox message={error}/>} {message&&<SuccessBox message={message}/>}<button className="button" disabled={busy} onClick={accept}>{busy?'Activating…':'Accept team invitation'}</button></div></div></section>;
}
