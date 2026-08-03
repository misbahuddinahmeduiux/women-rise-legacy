import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorBox, Loader, SuccessBox } from '../components/UI';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function MentorOnboarding(){
  const [params]=useSearchParams();
  const {refreshAccess}=useAuth();
  const [profile,setProfile]=useState<any|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  async function load(){
    setLoading(true);setError('');
    try{
      const token=params.get('mentor_invitation');
      if(token)await api('/phase4/mentor-invitations/accept',{method:'POST',body:JSON.stringify({token})});
      const data=await api<any>('/phase4/mentor-profile');setProfile(data);await refreshAccess();
    }catch(e){setError(e instanceof Error?e.message:'Mentor profile could not be loaded.')}finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);

  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError('');setMessage('');const fd=new FormData(e.currentTarget);
    try{
      const data=await api<any>('/phase4/mentor-profile',{method:'PUT',body:JSON.stringify({
        professionalTitle:fd.get('professionalTitle'),biography:fd.get('biography'),
        expertise:String(fd.get('expertise')||'').split(',').map(v=>v.trim()).filter(Boolean),
        skills:String(fd.get('skills')||'').split(',').map(v=>v.trim()).filter(Boolean),
        industry:fd.get('industry'),yearsExperience:fd.get('yearsExperience')?Number(fd.get('yearsExperience')):null,
        languages:String(fd.get('languages')||'').split(',').map(v=>v.trim()).filter(Boolean),
        availability:fd.get('availability'),timezone:fd.get('timezone'),maximumMentees:Number(fd.get('maximumMentees')||3),
        sessionFormat:fd.get('sessionFormat'),consentAccepted:fd.get('consentAccepted')==='on'
      })});setProfile(data);setMessage('Mentor profile saved.');await refreshAccess();
    }catch(e){setError(e instanceof Error?e.message:'Profile could not be saved.')}
  }
  async function submit(){try{const result=await api<{message:string;mentorProfile:any}>('/phase4/mentor-profile/submit',{method:'POST'});setProfile(result.mentorProfile);setMessage(result.message);await refreshAccess()}catch(e){setError(e instanceof Error?e.message:'Profile could not be submitted.')}}

  if(loading)return <div className="page-center"><Loader/></div>;
  return <section className="section"><div className="container narrow"><span className="eyebrow">Mentor onboarding</span><h1>Complete your mentor profile</h1><p>Your profile stays private until it is complete and approved by an authorized administrator.</p>{error&&<ErrorBox message={error}/>} {message&&<SuccessBox message={message}/>} {profile&&<form className="card form-grid" onSubmit={save}>
    <label>Professional title<input name="professionalTitle" defaultValue={profile.professional_title||''} required/></label>
    <label>Industry<input name="industry" defaultValue={profile.industry||''}/></label>
    <label className="wide">Biography<textarea name="biography" rows={6} defaultValue={profile.biography||''} required/></label>
    <label className="wide">Expertise, comma separated<input name="expertise" defaultValue={(profile.expertise||[]).join(', ')} required/></label>
    <label className="wide">Skills, comma separated<input name="skills" defaultValue={(profile.mentor_skills||[]).join(', ')}/></label>
    <label>Years of experience<input name="yearsExperience" type="number" min="0" max="80" defaultValue={profile.years_experience??''}/></label>
    <label>Languages<input name="languages" defaultValue={(profile.languages||[]).join(', ')}/></label>
    <label>Timezone<input name="timezone" defaultValue={profile.timezone||''} required/></label>
    <label>Maximum mentees<input name="maximumMentees" type="number" min="1" max="100" defaultValue={profile.maximum_mentees||3}/></label>
    <label className="wide">Availability<textarea name="availability" rows={4} defaultValue={profile.availability||''} required/></label>
    <label className="wide">Session format<input name="sessionFormat" defaultValue={profile.session_format||''} placeholder="Virtual, in-person, phone" required/></label>
    <label className="checkbox wide"><input name="consentAccepted" type="checkbox" defaultChecked={Boolean(profile.consent_accepted_at)} required/>I accept the mentor code of conduct and directory policy.</label>
    <div className="wide hero-actions"><button className="button">Save profile</button><button type="button" className="button secondary" onClick={submit} disabled={profile.profile_status==='pending_approval'}>{profile.profile_status==='pending_approval'?'Pending approval':'Submit for approval'}</button></div>
  </form>}</div></section>
}
