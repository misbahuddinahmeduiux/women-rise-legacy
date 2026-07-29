import { Building2, Crown, GraduationCap, HandHeart, HeartHandshake, PackageCheck, Sparkles, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { PageHero, SectionHeading } from '../components/UI';
import { api } from '../lib/api';

function useCmsPage(key:string,fallback:Record<string,any>){
  const [content,setContent]=useState(fallback);
  useEffect(()=>{api<{value:Record<string,any>}>(`/phase4/content/${encodeURIComponent(key)}`).then(row=>setContent({...fallback,...row.value})).catch(()=>undefined)},[key]);
  return content;
}

const icons:Record<string,any>={crown:Crown,users:Users,building:Building2,hand:HandHeart,package:PackageCheck,heart:HeartHandshake,sparkles:Sparkles,education:GraduationCap};
const defaultAbout={
  seoTitle:'About Women Rise Legacy',seoDescription:'Learn how Women Rise Legacy connects women through mentorship, leadership, enterprise, community, and humanitarian service.',
  eyebrow:'Who we are',title:'A women-led movement connecting growth with service',heroText:'Women Rise Legacy Network supports women through mentorship, leadership, business visibility, resources, events, chapters, and a humanitarian Foundation serving families and communities.',
  founderEyebrow:"Our founder's vision",founderTitle:'When women rise with support, communities inherit the impact',founderText:'Women Rise Legacy was built around a clear belief: women should not have to build alone. The Network creates spaces for healing, professional growth, entrepreneurship, leadership, and meaningful connection. The Foundation turns that strength outward through practical aid, sponsorship, volunteer action, and responsible partnerships.',founderImage:'/assets/brand/event-founder.webp',founderImageAlt:'Women Rise Legacy founder speaking',founderBadge:'Heal. Build. Lead.',
  commitments:['Help women build confidence, skills, and visible leadership','Create trusted mentorship and business connections','Support women-owned businesses and professional opportunities','Protect dignity and privacy in humanitarian workflows','Turn individual growth into community legacy'],founderButtonLabel:'Explore membership',founderButtonTo:'/membership',
  pillarsEyebrow:'Our pillars',pillarsTitle:'Five commitments shape every program',pillars:[{icon:'sparkles',title:'Empower',text:'Build confidence, voice, and personal agency.'},{icon:'heart',title:'Support',text:'Create community care and practical pathways.'},{icon:'education',title:'Educate',text:'Share tools, insight, and development opportunities.'},{icon:'crown',title:'Lead',text:'Prepare women to lead with values and visibility.'},{icon:'hand',title:'Legacy',text:'Use growth to create opportunity for others.'}],
  armsImage:'/assets/brand/event-community.webp',armsImageAlt:'Women Rise Legacy community',armsEyebrow:'One brand, two impact arms',armsTitle:'Network growth and Foundation service work together',networkTitle:'Women Rise Legacy Network',networkText:'Focuses on membership, mentorship, leadership, entrepreneurship, directories, resources, events, and chapters.',foundationTitle:'Women Rise Legacy Foundation',foundationText:'Focuses on financial giving, item donations, current needs, family sponsorship, assistance requests, volunteers, partners, disaster response, and impact reporting.',networkButtonLabel:'Meet the network',networkButtonTo:'/members',foundationButtonLabel:'Support the Foundation',foundationButtonTo:'/get-involved'
};

export function About() {
  const content=useCmsPage('page.about',defaultAbout);
  const commitments=Array.isArray(content.commitments)?content.commitments:defaultAbout.commitments;
  const pillars=Array.isArray(content.pillars)?content.pillars:defaultAbout.pillars;
  return <>
    <Seo title={content.seoTitle||content.title} description={content.seoDescription||content.heroText}/>
    <PageHero eyebrow={content.eyebrow} title={content.title} text={content.heroText}/>
    <section className="section"><div className="container split"><div><SectionHeading eyebrow={content.founderEyebrow} title={content.founderTitle}/><p>{content.founderText}</p><ul className="list-check">{commitments.map((item:string)=><li key={item}>{item}</li>)}</ul><Link className="button" to={content.founderButtonTo||'/membership'}>{content.founderButtonLabel||'Explore membership'}</Link></div><div className="founder-stage-card"><img src={content.founderImage} alt={content.founderImageAlt||''}/><img className="official-logo-badge" src="/assets/brand/logo.webp" alt="Official Women Rise Legacy Network logo"/><div><Crown/><span>{content.founderBadge}</span></div></div></div></section>
    <section className="section alt"><div className="container"><SectionHeading centered eyebrow={content.pillarsEyebrow} title={content.pillarsTitle}/><div className="feature-grid five">{pillars.map((pillar:any)=>{const Icon=icons[pillar.icon]||Sparkles;return <div className="feature" key={pillar.title}><Icon/><h3>{pillar.title}</h3><p>{pillar.text}</p></div>})}</div></div></section>
    <section className="section"><div className="container split reverse-mobile"><img className="image-rounded" src={content.armsImage} alt={content.armsImageAlt||''}/><div><SectionHeading eyebrow={content.armsEyebrow} title={content.armsTitle}/><p><b>{content.networkTitle}</b> {content.networkText}</p><p><b>{content.foundationTitle}</b> {content.foundationText}</p><div className="hero-actions"><Link className="button ghost" to={content.networkButtonTo||'/members'}>{content.networkButtonLabel||'Meet the network'}</Link><Link className="button ghost" to={content.foundationButtonTo||'/get-involved'}>{content.foundationButtonLabel||'Support the Foundation'}</Link></div></div></div></section>
  </>;
}

const defaultActions=[
  {title:'Become a member',text:'Join a community designed for connection, development, visibility, and leadership.',to:'/membership',icon:'crown',buttonLabel:'Get started'},
  {title:'Find a mentor',text:'Request guidance based on your goals, preferred topics, and availability.',to:'/mentors',icon:'users',buttonLabel:'Get started'},
  {title:'List or discover a business',text:'Support women-owned businesses and professional service providers.',to:'/businesses',icon:'building',buttonLabel:'Get started'},
  {title:'Donate money',text:'Support campaigns, current needs, or a family through a secure donation flow.',to:'/donate',icon:'hand',buttonLabel:'Get started'},
  {title:'Donate useful items',text:'Offer clothing, school supplies, hygiene items, baby essentials, toys, or blankets.',to:'/donate-items',icon:'package',buttonLabel:'Get started'},
  {title:'Volunteer or partner',text:'Share skills, logistics support, sponsorship, outreach, or organizational capacity.',to:'/volunteer',icon:'heart',buttonLabel:'Get started'}
];
export function GetInvolved() {
  const content=useCmsPage('page.get-involved',{seoTitle:'Get Involved',seoDescription:'Join, volunteer, donate, partner, find mentorship, or support women-owned businesses through Women Rise Legacy.',eyebrow:'Take action',title:'Choose how you want to grow, connect, or contribute',heroText:'Women Rise Legacy offers pathways for personal growth, professional connection, business visibility, and humanitarian service.',actions:defaultActions});
  const actions=Array.isArray(content.actions)?content.actions:defaultActions;
  return <><Seo title={content.seoTitle||content.title} description={content.seoDescription||content.heroText}/><PageHero eyebrow={content.eyebrow} title={content.title} text={content.heroText}/><section className="section"><div className="container get-involved-grid">{actions.map((item:any)=>{const Icon=icons[item.icon]||Sparkles;return <div className="action-card" key={item.title}><span className="feature-icon"><Icon/></span><h3>{item.title}</h3><p>{item.text}</p><Link className="button ghost" to={item.to}>{item.buttonLabel||'Get started'}</Link></div>})}</div></section></>;
}

const defaultPrograms=[
  {title:'Leadership & Mentorship',text:'Mentor matching, leadership conversations, visibility, and professional development.',icon:'crown'},
  {title:'Business & Opportunity',text:'Women-owned business visibility, product and service discovery, opportunities, and collaboration.',icon:'building'},
  {title:'Family Assistance',text:'Verified help for clothing, hygiene, baby items, blankets, and household essentials.',icon:'heart'},
  {title:'Education Support',text:'School supplies, learning materials, scholarships, and community education projects.',icon:'education'},
  {title:'Disaster Relief',text:'Rapid fundraising and item coordination during emergencies and displacement.',icon:'hand'},
  {title:'Community & Chapters',text:'Local and virtual spaces for networking, workshops, outreach, and leadership.',icon:'users'}
];
export function Programs() {
  const content=useCmsPage('page.programs',{seoTitle:'Programs',seoDescription:'Explore Women Rise Legacy mentorship, leadership, enterprise, education, assistance, relief, and chapter programs.',eyebrow:'Programs',title:'Practical programs across Network growth and Foundation service',heroText:'Our programs connect immediate support with leadership, enterprise, learning, and long-term community resilience.',programs:defaultPrograms});
  const programs=Array.isArray(content.programs)?content.programs:defaultPrograms;
  return <><Seo title={content.seoTitle||content.title} description={content.seoDescription||content.heroText}/><PageHero eyebrow={content.eyebrow} title={content.title} text={content.heroText}/><section className="section"><div className="container feature-grid">{programs.map((item:any)=>{const Icon=icons[item.icon];return <div className="feature" key={item.title}>{Icon&&<Icon/>}<h3>{item.title}</h3><p>{item.text}</p></div>})}</div></section></>;
}
