import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Field } from '../components/FormFields';
import { ErrorBox, SuccessBox } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const { user, signIn } = useAuth(); const nav=useNavigate(); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  if(user)return <Navigate to="/dashboard" replace/>;
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);setError('');const f=new FormData(e.currentTarget);try{await signIn(String(f.get('email')),String(f.get('password')));nav('/dashboard');}catch(e){setError(e instanceof Error?e.message:'Login failed.');}finally{setLoading(false)}}
  return <div className="auth-wrap"><div className="auth-card"><span className="eyebrow">Member access</span><h2>Welcome back</h2><p>Sign in to view your profile, donations, and application status.</p>{error&&<ErrorBox message={error}/>}<form onSubmit={submit}><Field label="Email" name="email" type="email" required/><Field label="Password" name="password" type="password" minLength={6} required/><button className="button" disabled={loading}>{loading?'Signing in…':'Sign in'}</button></form><p>New here? <Link className="text-link" to="/register">Create an account</Link></p></div></div>;
}
export function Register() {
  const { user, signUp }=useAuth(); const [error,setError]=useState(''); const [success,setSuccess]=useState(''); const [loading,setLoading]=useState(false);
  if(user)return <Navigate to="/dashboard" replace/>;
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);setError('');setSuccess('');const f=new FormData(e.currentTarget);if(f.get('password')!==f.get('confirmPassword')){setError('Passwords do not match.');setLoading(false);return;}try{await signUp(String(f.get('fullName')),String(f.get('email')),String(f.get('password')));setSuccess('Account created. Check your email if confirmation is enabled in Supabase.');e.currentTarget.reset();}catch(e){setError(e instanceof Error?e.message:'Registration failed.');}finally{setLoading(false)}}
  return <div className="auth-wrap"><div className="auth-card"><span className="eyebrow">Join the community</span><h2>Create your account</h2><p>Create your secure account, then apply for membership, build your profile, access eligible resources, and track your network and Foundation activity.</p>{error&&<ErrorBox message={error}/>} {success&&<SuccessBox message={success}/>}<form onSubmit={submit}><Field label="Full name" name="fullName" required/><Field label="Email" name="email" type="email" required/><Field label="Password" name="password" type="password" minLength={8} required/><Field label="Confirm password" name="confirmPassword" type="password" minLength={8} required/><button className="button" disabled={loading}>{loading?'Creating account…':'Create account'}</button></form><p>Already registered? <Link className="text-link" to="/login">Sign in</Link></p></div></div>;
}
