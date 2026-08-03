import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { Field } from '../components/FormFields';
import { ErrorBox, SuccessBox } from '../components/UI';
import { Seo } from '../components/Seo';
import { useAuth } from '../contexts/AuthContext';

function AuthFrame({ eyebrow, title, text, children, mode }: { eyebrow: string; title: string; text: string; children: ReactNode; mode: 'login' | 'register' | 'recovery' }) {
  const features = mode === 'register'
    ? ['Build your member profile', 'Choose a membership pathway', 'Access eligible network resources']
    : mode === 'login'
      ? ['Manage membership and receipts', 'Track events and mentorship', 'Keep your public profile current']
      : ['Secure account recovery', 'Protected reset flow', 'Return to your member dashboard'];
  return <div className="auth-experience"><div className="auth-brand-panel"><div className="auth-brand-content"><Link className="auth-brand" to="/"><img src="/assets/brand/logo-mark.webp" alt="Women Rise Legacy" /><span><strong>Women Rise</strong><small>Legacy Network</small></span></Link><div className="auth-brand-message"><span className="auth-brand-kicker"><Sparkles />A trusted global community</span><h1>Your next chapter deserves a strong network.</h1><p>Connect with women, mentorship, leadership opportunities and practical support in one secure member experience.</p><div className="auth-feature-list">{features.map((feature) => <div key={feature}><CheckCircle2 /><span>{feature}</span></div>)}</div></div><small className="auth-security-note"><ShieldCheck />Secure account access powered by Supabase authentication.</small></div></div><div className="auth-form-panel"><div className="auth-card professional-auth-card"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p>{children}</div></div></div>;
}

function PasswordField({ label, name, autoComplete, minLength = 6 }: { label: string; name: string; autoComplete: string; minLength?: number }) {
  const [visible, setVisible] = useState(false);
  return <label className="field password-field"><span>{label}</span><div><LockKeyhole /><input name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} required /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff /> : <Eye />}</button></div></label>;
}

export function Login() {
  const { user, signIn } = useAuth(); const navigate = useNavigate(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(''); const form = new FormData(event.currentTarget);
    try { await signIn(String(form.get('email')), String(form.get('password'))); navigate('/dashboard'); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Login failed.'); }
    finally { setLoading(false); }
  }
  return <><Seo title="Member Login" description="Secure member access for Women Rise Legacy." noIndex /><AuthFrame mode="login" eyebrow="Member access" title="Welcome back" text="Sign in to continue your membership, connections and impact journey.">{error && <ErrorBox message={error} />}<form className="auth-professional-form" onSubmit={submit}><label className="field icon-field"><span>Email address</span><div><Mail /><input name="email" type="email" autoComplete="email" required /></div></label><PasswordField label="Password" name="password" autoComplete="current-password" /><div className="auth-form-meta"><label><input type="checkbox" />Remember me</label><Link className="text-link" to="/forgot-password">Forgot password?</Link></div><button className="button auth-submit" disabled={loading}>{loading ? 'Signing in…' : <>Sign in securely<ArrowRight /></>}</button></form><div className="auth-switch"><span>New to Women Rise Legacy?</span><Link to="/register">Create your account<ArrowRight /></Link></div></AuthFrame></>;
}

export function Register() {
  const { user, signUp } = useAuth(); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(''); setSuccess(''); const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirmPassword')) { setError('Passwords do not match.'); setLoading(false); return; }
    try { await signUp(String(form.get('fullName')), String(form.get('email')), String(form.get('password'))); setSuccess('Account created. Check your email if confirmation is enabled in Supabase.'); event.currentTarget.reset(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Registration failed.'); }
    finally { setLoading(false); }
  }
  return <><Seo title="Create Account" description="Join Women Rise Legacy Network." noIndex /><AuthFrame mode="register" eyebrow="Join the community" title="Create your account" text="Start with a secure account, then build your profile and choose the membership that fits your next chapter.">{error && <ErrorBox message={error} />}{success && <SuccessBox message={success} />}<form className="auth-professional-form" onSubmit={submit}><label className="field icon-field"><span>Full name</span><div><UserRound /><input name="fullName" autoComplete="name" required /></div></label><label className="field icon-field"><span>Email address</span><div><Mail /><input name="email" type="email" autoComplete="email" required /></div></label><div className="auth-password-grid"><PasswordField label="Password" name="password" autoComplete="new-password" minLength={8} /><PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" minLength={8} /></div><label className="auth-consent"><input type="checkbox" required /><span>I agree to create a secure Women Rise Legacy account and receive essential account communication.</span></label><button className="button auth-submit" disabled={loading}>{loading ? 'Creating account…' : <>Create account<ArrowRight /></>}</button></form><div className="auth-switch"><span>Already registered?</span><Link to="/login">Sign in<ArrowRight /></Link></div></AuthFrame></>;
}

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth(); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setError(''); const form = new FormData(event.currentTarget); try { await requestPasswordReset(String(form.get('email'))); setSuccess('Password reset instructions have been sent. Check your inbox and spam folder.'); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Reset request failed.'); } finally { setLoading(false); } }
  return <><Seo title="Reset Password" description="Request a secure Women Rise Legacy password reset." noIndex /><AuthFrame mode="recovery" eyebrow="Account recovery" title="Reset your password" text="Enter the email connected to your account. We will send a secure reset link.">{error && <ErrorBox message={error} />}{success && <SuccessBox message={success} />}<form className="auth-professional-form" onSubmit={submit}><label className="field icon-field"><span>Email address</span><div><Mail /><input name="email" type="email" autoComplete="email" required /></div></label><button className="button auth-submit" disabled={loading}>{loading ? 'Sending…' : <>Send reset link<ArrowRight /></>}</button></form><div className="auth-switch"><Link to="/login">Return to sign in<ArrowRight /></Link></div></AuthFrame></>;
}

export function ResetPassword() {
  const { updatePassword } = useAuth(); const navigate = useNavigate(); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setError(''); const form = new FormData(event.currentTarget); const password = String(form.get('password')); if (password !== String(form.get('confirmPassword'))) { setError('Passwords do not match.'); setLoading(false); return; } try { await updatePassword(password); setSuccess('Password updated successfully. Redirecting to your dashboard…'); setTimeout(() => navigate('/dashboard'), 1200); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Password could not be updated.'); } finally { setLoading(false); } }
  return <><Seo title="Choose New Password" description="Choose a new secure account password." noIndex /><AuthFrame mode="recovery" eyebrow="Secure update" title="Choose a new password" text="Use at least eight characters and keep this password private.">{error && <ErrorBox message={error} />}{success && <SuccessBox message={success} />}<form className="auth-professional-form" onSubmit={submit}><PasswordField label="New password" name="password" autoComplete="new-password" minLength={8} /><PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" minLength={8} /><button className="button auth-submit" disabled={loading}>{loading ? 'Updating…' : <>Update password<ArrowRight /></>}</button></form></AuthFrame></>;
}
