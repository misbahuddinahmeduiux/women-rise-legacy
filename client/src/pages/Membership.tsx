import { ArrowRight, BadgeCheck, Check, Crown, LoaderCircle, ShieldCheck, Sparkles, Users, WalletCards, Zap } from 'lucide-react';
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
function availableCycles(plan:MembershipPlan):BillingCycle[]{const cycles:BillingCycle[]=[];if(plan.monthly_enabled)cycles.push('monthly');if(plan.yearly_enabled)cycles.push('yearly');if(plan.one_time_enabled)cycles.push('one_time');return cycles;}
function price(plan:MembershipPlan,cycle:BillingCycle){if(cycle==='monthly')return plan.monthly_price;if(cycle==='yearly')return plan.yearly_price;return plan.one_time_price;}
function cycleLabel(cycle:BillingCycle){return cycle==='one_time'?'One-time / lifetime':cycle[0].toUpperCase()+cycle.slice(1)}

export default function Membership(){
  const [plans,setPlans]=useState<MembershipPlan[]>([]);const [methods,setMethods]=useState<PaymentMethod[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [preferredCycle,setPreferredCycle]=useState<BillingCycle>('monthly');
  const {user}=useAuth();
  const content=useWebsiteContent('page.membership',{seoTitle:'Membership Plans',seoDescription:'Compare dynamic Rise, Legacy, and Elite Women Rise Legacy membership plans.',eyebrow:'Membership pathways',title:'Choose the membership that matches your next chapter',heroText:'Membership plans, prices, billing options, and benefits are managed directly by the Women Rise Legacy team.',signedInButton:'Open member dashboard',signedOutButton:'Create your account',activationEyebrow:'Automatic activation',activationTitle:'Your access begins after verified payment',activationText:'After Stripe or PayPal confirms a successful payment, the selected membership activates automatically. You receive plan-based access, a payment record, and a membership confirmation email.',activationImage:'/assets/client/women-rise-community-dinner.webp',activationImageAlt:'Women Rise Legacy members connecting at an event',trustItems:['Verified gateway confirmation','Immediate plan access','Renewal and expiry management']});
  useEffect(()=>{Promise.all([api<MembershipPlan[]>('/memberships/plans'),api<PaymentMethod[]>('/payments/methods')]).then(([planRows,methodRows])=>{setPlans(planRows);setMethods(methodRows)}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  const availableGlobalCycles=useMemo(()=>['monthly','yearly','one_time'].filter(cycle=>plans.some(plan=>availableCycles(plan).includes(cycle as BillingCycle))) as BillingCycle[],[plans]);
  useEffect(()=>{if(availableGlobalCycles.length&&!availableGlobalCycles.includes(preferredCycle))setPreferredCycle(availableGlobalCycles[0]);},[availableGlobalCycles,preferredCycle]);
  return <>
    <Seo title={content.seoTitle} description={content.seoDescription}/>
    <PageHero eyebrow={content.eyebrow} title={content.title} text={content.heroText}>{user?<Link className="button" to="/dashboard">{content.signedInButton}</Link>:<Link className="button" to="/register">{content.signedOutButton}</Link>}</PageHero>
    <section className="membership-trust-strip"><div className="container"><span><ShieldCheck/>Secure checkout</span><span><Zap/>Automatic activation</span><span><Users/>Member directory access</span><span><BadgeCheck/>Plan-based mentorship</span></div></section>
    <section className="section membership-pricing-section"><div className="container">
      <div className="membership-pricing-heading"><div><span className="eyebrow">Transparent pathways</span><h2>Compare plans and choose with confidence</h2><p>Switch billing options to compare available prices. Your selected plan activates after a verified payment.</p></div>{availableGlobalCycles.length>1&&<div className="billing-cycle-switcher" role="group" aria-label="Billing options">{availableGlobalCycles.map(cycle=><button key={cycle} className={preferredCycle===cycle?'active':''} onClick={()=>setPreferredCycle(cycle)}>{cycleLabel(cycle)}{cycle==='yearly'&&<small>Best value</small>}</button>)}</div>}</div>
      {error&&<ErrorBox message={error}/>} {loading&&<Loader/>}
      {!loading&&!error&&!plans.length&&<div className="empty"><h2>No active membership plans</h2><p>The team is updating membership options. Please check again soon.</p></div>}
      <div className="plan-grid dynamic-plan-grid professional-plan-grid">{plans.map(plan=><PlanCard key={plan.id} plan={plan} methods={methods} loggedIn={Boolean(user)} preferredCycle={preferredCycle}/>)}</div>
      {plans.length>0&&<div className="membership-comparison-note"><WalletCards/><div><strong>Not sure which path fits?</strong><p>Rise supports discovery, Legacy adds mentorship requests, and Elite provides priority or private mentorship when available.</p></div><Link className="button ghost" to="/contact">Talk with the team</Link></div>}
    </div></section>
    <section className="section alt membership-activation-section"><div className="container split"><div><SectionHeading eyebrow={content.activationEyebrow} title={content.activationTitle}/><p>{content.activationText}</p><div className="membership-trust-list"><span><ShieldCheck/>{content.trustItems?.[0]||'Verified gateway confirmation'}</span><span><Sparkles/>{content.trustItems?.[1]||'Immediate plan access'}</span><span><Crown/>{content.trustItems?.[2]||'Renewal and expiry management'}</span></div></div><img className="image-rounded" src={content.activationImage} alt={content.activationImageAlt||''}/></div></section>
  </>;
}

function PlanCard({plan,methods,loggedIn,preferredCycle}:{plan:MembershipPlan;methods:PaymentMethod[];loggedIn:boolean;preferredCycle:BillingCycle}){
  const cycles=availableCycles(plan);const defaultCycle=cycles.includes(preferredCycle)?preferredCycle:(cycles[0]||'monthly');const [cycle,setCycle]=useState<BillingCycle>(defaultCycle);
  useEffect(()=>{if(cycles.includes(preferredCycle))setCycle(preferredCycle)},[preferredCycle,plan.id]);
  const eligibleMethods=useMemo(()=>methods.filter(method=>cycle==='one_time'||method.supportsRecurring||method.provider==='demo'),[methods,cycle]);
  const [provider,setProvider]=useState<PaymentMethod['provider']>(eligibleMethods[0]?.provider||'demo');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');const navigate=useNavigate();
  useEffect(()=>{if(!eligibleMethods.some(method=>method.provider===provider))setProvider(eligibleMethods[0]?.provider||'demo')},[eligibleMethods,provider]);
  async function checkout(){setError('');setMessage('');if(!loggedIn){navigate(`/login?redirect=${encodeURIComponent('/membership')}`);return}if(!eligibleMethods.length){setError('No compatible payment method is currently connected.');return}setBusy(true);try{const result=await api<{url:string;paymentId:string;demoMode?:boolean}>('/memberships/checkout',{method:'POST',body:JSON.stringify({planId:plan.id,billingCycle:cycle,provider})});setMessage('Secure checkout created. Redirecting…');window.location.assign(result.url);}catch(e){setError(e instanceof Error?e.message:'Checkout could not be created.');setBusy(false)}}
  const amount=price(plan,cycle);const suffix=cycle==='monthly'?'/ month':cycle==='yearly'?'/ year':plan.one_time_lifetime?'lifetime':'one-time';
  return <article className={`plan-card dynamic-plan-card professional-plan-card ${plan.is_featured?'featured':''}`}>
    {(plan.badge_text||plan.is_featured)&&<span className="popular">{plan.badge_text||'Most popular'}</span>}
    <div className="plan-card-top"><div className="plan-icon"><Crown/></div><span className={`plan-level-dot ${plan.access_level}`}>{plan.access_level}</span></div><span className="eyebrow">{plan.tagline||`${plan.access_level} membership`}</span><h2>{plan.name}</h2><p>{plan.description}</p>
    <div className="plan-price"><strong>{formatMoney(amount,plan.currency)}</strong><span>{suffix}</span></div>
    {cycles.length>1&&<label className="plan-control"><span>Billing option</span><select value={cycle} onChange={event=>setCycle(event.target.value as BillingCycle)}>{cycles.map(item=><option value={item} key={item}>{cycleLabel(item)}</option>)}</select></label>}
    <div className="plan-benefit-heading"><span>What is included</span></div><ul className="plan-feature-list">{(plan.features||[]).map(feature=><li key={feature}><Check/>{feature}</li>)}</ul>
    <div className="plan-access-summary"><span><Check/>Directory: {plan.directory_access?'Included':'Not included'}</span><span><Check/>Mentorship: {plan.mentorship_access==='priority'?'Priority/private':plan.mentorship_access==='request'?'Requests included':'Browse mentors'}</span>{plan.business_listing&&<span><Check/>Business listing included</span>}{plan.featured_visibility&&<span><Check/>Featured visibility</span>}</div>
    {eligibleMethods.length>0&&<label className="plan-control"><span>Payment method</span><select value={provider} onChange={event=>setProvider(event.target.value as PaymentMethod['provider'])}>{eligibleMethods.map(method=><option value={method.provider} key={method.provider}>{method.displayName}{method.mode==='test'?' (Test)':''}</option>)}</select></label>}
    {message&&<SuccessBox message={message}/>} {error&&<ErrorBox message={error}/>}<button className="button plan-checkout-button" disabled={busy||amount==null} onClick={checkout}>{busy?<><LoaderCircle className="spin"/>Creating checkout…</>:<>{loggedIn?'Choose':'Sign in for'} {plan.name}<ArrowRight/></>}</button>
    <small className="plan-secure-note"><ShieldCheck/>Secure checkout · automatic membership activation</small>{plan.trial_days>0&&<small>{plan.trial_days}-day trial configured by admin.</small>}
  </article>;
}
