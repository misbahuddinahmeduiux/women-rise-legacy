import { ArrowRight, Check, Crown, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBox, Loader, PageHero, SectionHeading, SuccessBox } from '../components/UI';
import { Seo } from '../components/Seo';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { useWebsiteContent } from '../hooks/useWebsiteContent';
import type { BillingCycle, MembershipPlan } from '../types';

type PaymentMethod = { provider:'stripe'|'paypal'|'bank_transfer'|'demo'; displayName:string; description:string; supportsRecurring:boolean; mode:string; currency:string };

function formatMoney(amount:number|null,currency:string){
  if(amount==null)return 'Not set';
  try{return new Intl.NumberFormat('en-US',{style:'currency',currency:currency.toUpperCase(),maximumFractionDigits:2}).format(amount)}catch{return `${currency.toUpperCase()} ${amount.toFixed(2)}`}
}

function availableCycles(plan:MembershipPlan):BillingCycle[]{
  const cycles:BillingCycle[]=[];
  if(plan.monthly_enabled)cycles.push('monthly');
  if(plan.yearly_enabled)cycles.push('yearly');
  if(plan.one_time_enabled)cycles.push('one_time');
  return cycles;
}

function price(plan:MembershipPlan,cycle:BillingCycle){
  if(cycle==='monthly')return plan.monthly_price;
  if(cycle==='yearly')return plan.yearly_price;
  return plan.one_time_price;
}

export default function Membership(){
  const [plans,setPlans]=useState<MembershipPlan[]>([]);
  const [methods,setMethods]=useState<PaymentMethod[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const {user}=useAuth();
  const content=useWebsiteContent('page.membership',{seoTitle:'Membership Plans',seoDescription:'Compare dynamic Rise, Legacy, and Elite Women Rise Legacy membership plans.',eyebrow:'Membership pathways',title:'Choose the membership that matches your next chapter',heroText:'Membership plans, prices, billing options, and benefits are managed directly by the Women Rise Legacy team.',signedInButton:'Open member dashboard',signedOutButton:'Create your account',activationEyebrow:'Automatic activation',activationTitle:'Your access begins after verified payment',activationText:'After Stripe or PayPal confirms a successful payment, the selected membership activates automatically. You receive plan-based access, a payment record, and a membership confirmation email.',activationImage:'/assets/brand/event-panel.webp',activationImageAlt:'Women Rise Legacy members in conversation',trustItems:['Verified gateway confirmation','Immediate plan access','Renewal and expiry management']});

  useEffect(()=>{
    Promise.all([api<MembershipPlan[]>('/memberships/plans'),api<PaymentMethod[]>('/payments/methods')])
      .then(([planRows,methodRows])=>{setPlans(planRows);setMethods(methodRows)})
      .catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[]);

  return <>
    <Seo title={content.seoTitle} description={content.seoDescription}/>
    <PageHero eyebrow={content.eyebrow} title={content.title} text={content.heroText}>
      {user?<Link className="button" to="/dashboard">{content.signedInButton}</Link>:<Link className="button" to="/register">{content.signedOutButton}</Link>}
    </PageHero>
    <section className="section"><div className="container">
      {error&&<ErrorBox message={error}/>} {loading&&<Loader/>}
      {!loading&&!error&&!plans.length&&<div className="empty"><h2>No active membership plans</h2><p>The team is updating membership options. Please check again soon.</p></div>}
      <div className="plan-grid dynamic-plan-grid">{plans.map(plan=><PlanCard key={plan.id} plan={plan} methods={methods} loggedIn={Boolean(user)}/>)}</div>
    </div></section>
    <section className="section alt"><div className="container split"><div><SectionHeading eyebrow={content.activationEyebrow} title={content.activationTitle}/><p>{content.activationText}</p><div className="membership-trust-list"><span><ShieldCheck/>{content.trustItems?.[0]||'Verified gateway confirmation'}</span><span><Sparkles/>{content.trustItems?.[1]||'Immediate plan access'}</span><span><Crown/>{content.trustItems?.[2]||'Renewal and expiry management'}</span></div></div><img className="image-rounded" src={content.activationImage} alt={content.activationImageAlt||''}/></div></section>
  </>;
}

function PlanCard({plan,methods,loggedIn}:{plan:MembershipPlan;methods:PaymentMethod[];loggedIn:boolean}){
  const cycles=availableCycles(plan);
  const [cycle,setCycle]=useState<BillingCycle>(cycles[0]||'monthly');
  const eligibleMethods=useMemo(()=>methods.filter(method=>cycle==='one_time'||method.supportsRecurring||method.provider==='demo'),[methods,cycle]);
  const [provider,setProvider]=useState<PaymentMethod['provider']>(eligibleMethods[0]?.provider||'demo');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const navigate=useNavigate();

  useEffect(()=>{if(!eligibleMethods.some(method=>method.provider===provider))setProvider(eligibleMethods[0]?.provider||'demo')},[eligibleMethods,provider]);

  async function checkout(){
    setError('');setMessage('');
    if(!loggedIn){navigate(`/login?redirect=${encodeURIComponent('/membership')}`);return}
    if(!eligibleMethods.length){setError('No compatible payment method is currently connected.');return}
    setBusy(true);
    try{
      const result=await api<{url:string;paymentId:string;demoMode?:boolean}>('/memberships/checkout',{method:'POST',body:JSON.stringify({planId:plan.id,billingCycle:cycle,provider})});
      setMessage('Secure checkout created. Redirecting…');
      window.location.assign(result.url);
    }catch(e){setError(e instanceof Error?e.message:'Checkout could not be created.');setBusy(false)}
  }

  const amount=price(plan,cycle);
  const suffix=cycle==='monthly'?'/ month':cycle==='yearly'?'/ year':plan.one_time_lifetime?'lifetime':'one-time';
  return <article className={`plan-card dynamic-plan-card ${plan.is_featured?'featured':''}`}>
    {(plan.badge_text||plan.is_featured)&&<span className="popular">{plan.badge_text||'Featured'}</span>}
    <div className="plan-icon"><Crown/></div><span className="eyebrow">{plan.tagline||plan.access_level}</span><h2>{plan.name}</h2><p>{plan.description}</p>
    <div className="plan-price"><strong>{formatMoney(amount,plan.currency)}</strong><span>{suffix}</span></div>
    {cycles.length>1&&<label className="plan-control"><span>Billing option</span><select value={cycle} onChange={event=>setCycle(event.target.value as BillingCycle)}>{cycles.map(item=><option value={item} key={item}>{item==='one_time'?'One-time':item[0].toUpperCase()+item.slice(1)}</option>)}</select></label>}
    <ul className="plan-feature-list">{(plan.features||[]).map(feature=><li key={feature}><Check/>{feature}</li>)}</ul>
    <div className="plan-access-summary"><span>Directory: {plan.directory_access?'Included':'Not included'}</span><span>Mentorship: {plan.mentorship_access==='priority'?'Priority/private':plan.mentorship_access==='request'?'Requests included':'Browse mentors'}</span>{plan.business_listing&&<span>Business listing included</span>}</div>
    {eligibleMethods.length>0&&<label className="plan-control"><span>Payment method</span><select value={provider} onChange={event=>setProvider(event.target.value as PaymentMethod['provider'])}>{eligibleMethods.map(method=><option value={method.provider} key={method.provider}>{method.displayName}{method.mode==='test'?' (Test)':''}</option>)}</select></label>}
    {message&&<SuccessBox message={message}/>} {error&&<ErrorBox message={error}/>}<button className="button plan-checkout-button" disabled={busy||amount==null} onClick={checkout}>{busy?<><LoaderCircle className="spin"/>Creating checkout…</>:<>{loggedIn?'Choose':'Sign in for'} {plan.name}<ArrowRight/></>}</button>
    {plan.trial_days>0&&<small>{plan.trial_days}-day trial configured by admin.</small>}
  </article>;
}
