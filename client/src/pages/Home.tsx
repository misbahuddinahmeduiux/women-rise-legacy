import {
  ArrowRight,
  Award,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Crown,
  GraduationCap,
  HandHeart,
  Heart,
  Network,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CampaignCard, NeedCard } from '../components/Cards';
import { SectionHeading } from '../components/UI';
import { api } from '../lib/api';
import type { Business, Campaign, CurrentNeed, MemberSuccessStory, NetworkEvent } from '../types';

const heroSlides = [
  {
    eyebrow: 'Founder-led global movement',
    title: 'Where women rise together, legacies begin.',
    text: 'Women Rise Legacy connects women with mentorship, leadership opportunities, business visibility, community, and practical support—all inside one trusted ecosystem.',
    primaryLabel: 'Join the network',
    primaryTo: '/membership',
    secondaryLabel: 'Meet the founder',
    secondaryTo: '/about',
    image: '/assets/brand/founder-transparent.png',
    imageAlt: 'Founder of Women Rise Legacy Network',
    imageMode: 'founder',
    badgeTitle: 'Founder-led vision',
    badgeText: 'Leadership rooted in lived experience',
    theme: 'founder-theme'
  },
  {
    eyebrow: 'Network. Mentorship. Visibility.',
    title: 'Build the relationships that move your vision forward.',
    text: 'Find mentors, trusted peers, women-owned businesses, events, and opportunities designed to help members grow with clarity and confidence.',
    primaryLabel: 'Explore the network',
    primaryTo: '/members',
    secondaryLabel: 'Find a mentor',
    secondaryTo: '/mentors',
    image: '/assets/brand/hero-network.webp',
    imageAlt: 'Women Rise Legacy community and network',
    imageMode: 'cover',
    badgeTitle: 'Global sisterhood',
    badgeText: 'Connection that creates opportunity',
    theme: 'network-theme'
  },
  {
    eyebrow: 'Humanitarian action with dignity',
    title: 'Turn generosity into verified, visible impact.',
    text: 'Support current needs, family sponsorships, education, disaster response, and women-led community initiatives with transparent progress.',
    primaryLabel: 'Make a donation',
    primaryTo: '/donate',
    secondaryLabel: 'Explore current needs',
    secondaryTo: '/current-needs',
    image: '/assets/brand/event-community.webp',
    imageAlt: 'Women Rise Legacy community impact event',
    imageMode: 'cover',
    badgeTitle: 'Dignity-first support',
    badgeText: 'Verified needs and transparent impact',
    theme: 'impact-theme'
  }
] as const;

export default function Home() {
  const [needs, setNeeds] = useState<CurrentNeed[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [stories, setStories] = useState<MemberSuccessStory[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [sliderPaused, setSliderPaused] = useState(false);
  const [stats, setStats] = useState({ activeNeeds: 0, campaigns: 0, beneficiaries: 0, itemsDistributed: 0, members: 0, businesses: 0 });

  useEffect(() => {
    Promise.all([
      api<CurrentNeed[]>('/public/current-needs'), api<Campaign[]>('/public/campaigns'), api<typeof stats>('/public/stats'),
      api<Business[]>('/public/businesses?featured=true'), api<NetworkEvent[]>('/public/events?upcoming=true'), api<MemberSuccessStory[]>('/public/member-success-stories')
    ]).then(([n, c, s, b, e, st]) => {
      setNeeds(n.slice(0, 3));
      setCampaigns(c.slice(0, 3));
      setStats(s);
      setBusinesses(b.slice(0, 3));
      setEvents(e.slice(0, 3));
      setStories(st.slice(0, 3));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (sliderPaused) return undefined;
    const timer = window.setInterval(() => {
      setActiveSlide(current => (current + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [sliderPaused]);

  const slide = heroSlides[activeSlide];
  const showPrevious = () => setActiveSlide(current => (current - 1 + heroSlides.length) % heroSlides.length);
  const showNext = () => setActiveSlide(current => (current + 1) % heroSlides.length);

  return <>
    <section
      className={`hero brand-hero hero-slider ${slide.theme}`}
      onMouseEnter={() => setSliderPaused(true)}
      onMouseLeave={() => setSliderPaused(false)}
      aria-roledescription="carousel"
      aria-label="Women Rise Legacy highlights"
    >
      <div className="hero-glow"/>
      <div className="hero-orbit hero-orbit-one"/>
      <div className="hero-orbit hero-orbit-two"/>
      <div className="container hero-grid">
        <div className="hero-copy hero-slide-copy" key={`copy-${activeSlide}`} aria-live="polite">
          <span className="eyebrow">{slide.eyebrow}</span>
          <h1>{slide.title}</h1>
          <p>{slide.text}</p>
          <div className="hero-actions">
            <Link className="button" to={slide.primaryTo}>{slide.primaryLabel} <ArrowRight size={18}/></Link>
            <Link className="button secondary" to={slide.secondaryTo}>{slide.secondaryLabel}</Link>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={18}/>Verified community</span>
            <span><Heart size={18}/>Dignity-first support</span>
            <span><Network size={18}/>Global connections</span>
          </div>
        </div>

        <div className="hero-visual brand-visual">
          <div className="hero-slider-frame">
            {heroSlides.map((item, index) => <div
              className={`hero-slide-image ${index === activeSlide ? 'active' : ''} ${item.imageMode === 'founder' ? 'founder-image-slide' : 'cover-image-slide'}`}
              key={item.image}
              aria-hidden={index !== activeSlide}
            >
              <img src={item.image} alt={index === activeSlide ? item.imageAlt : ''}/>
            </div>)}
            <div className="hero-image-shine"/>
            <div className="floating-card hero-badge-card">
              <span className="floating-icon">{activeSlide === 0 ? <Crown/> : activeSlide === 1 ? <Users/> : <HandHeart/>}</span>
              <div><b>{slide.badgeTitle}</b><small>{slide.badgeText}</small></div>
            </div>
            <button className="slider-arrow slider-arrow-left" type="button" onClick={showPrevious} aria-label="Previous banner"><ChevronLeft/></button>
            <button className="slider-arrow slider-arrow-right" type="button" onClick={showNext} aria-label="Next banner"><ChevronRight/></button>
          </div>
          <div className="slider-dots" role="tablist" aria-label="Choose banner">
            {heroSlides.map((item, index) => <button
              type="button"
              key={item.title}
              className={index === activeSlide ? 'active' : ''}
              onClick={() => setActiveSlide(index)}
              aria-label={`Show banner ${index + 1}: ${item.eyebrow}`}
              aria-selected={index === activeSlide}
              role="tab"
            />)}
          </div>
        </div>
      </div>
    </section>

    <div className="container stats brand-stats"><div className="stat"><strong>{stats.members}+</strong><span>Network members</span></div><div className="stat"><strong>{stats.businesses}+</strong><span>Women-led businesses</span></div><div className="stat"><strong>{stats.activeNeeds}+</strong><span>Active needs</span></div><div className="stat"><strong>{stats.beneficiaries}+</strong><span>People supported</span></div></div>

    <section className="section"><div className="container split founder-section"><div className="founder-portrait-wrap"><div className="portrait-halo"/><img className="founder-portrait" src="/assets/brand/founder-transparent.png" alt="Founder of Women Rise Legacy Network"/></div><div><SectionHeading eyebrow="Founder-led movement" title="Built to help women turn healing into leadership" text="Women Rise Legacy brings community, mentorship, education, enterprise, and humanitarian service into one trusted ecosystem."/><p>Members are encouraged to grow personally, lead professionally, build sustainable ventures, and use their influence to create opportunity for other women and families.</p><div className="pillar-mini-grid"><div><Sparkles/><b>Empower</b><span>Build confidence and clarity.</span></div><div><HandHeart/><b>Support</b><span>Access practical community care.</span></div><div><GraduationCap/><b>Educate</b><span>Learn skills that move careers forward.</span></div><div><Crown/><b>Lead</b><span>Step into visible, values-led leadership.</span></div></div><Link className="text-link" to="/about">Read our story <ArrowRight size={16}/></Link></div></div></section>

    <section className="section alt"><div className="container"><SectionHeading centered eyebrow="One ecosystem, multiple pathways" title="Grow your network and your impact" text="Choose the pathway that meets you where you are today and supports where you want to go next."/><div className="feature-grid four"><Link className="feature feature-link" to="/membership"><span className="feature-icon"><Crown/></span><h3>Membership</h3><p>Rise, Legacy, and Elite pathways for connection, visibility, resources, and leadership growth.</p></Link><Link className="feature feature-link" to="/mentors"><span className="feature-icon"><Users/></span><h3>Mentorship</h3><p>Browse trusted mentors and submit a guided request based on your goals and preferred topics.</p></Link><Link className="feature feature-link" to="/businesses"><span className="feature-icon"><Building2/></span><h3>Business Directory</h3><p>Discover women-owned businesses, professional services, and member-led brands.</p></Link><Link className="feature feature-link" to="/opportunities"><span className="feature-icon"><Award/></span><h3>Opportunities</h3><p>Explore jobs, grants, scholarships, speaking opportunities, vendor events, and conferences.</p></Link></div></div></section>

    <section className="section"><div className="container"><div className="section-row"><SectionHeading eyebrow="Women-owned enterprise" title="Featured businesses" text="Meet members turning expertise, creativity, and resilience into growing brands."/><Link className="button ghost" to="/businesses">Browse directory</Link></div><div className="business-preview-grid">{businesses.length ? businesses.map(b => <Link className="business-preview" to={`/businesses/${b.slug}`} key={b.id}><img src={b.image_url || '/assets/brand/event-community.webp'} alt=""/><div><span>{b.industry}</span><h3>{b.name}</h3><p>{b.city}, {b.country}</p></div></Link>) : <div className="empty compact"><p>Featured businesses will appear after Phase 2 SQL is installed.</p></div>}</div></div></section>

    <section className="section media-strip"><div className="container"><SectionHeading centered eyebrow="A community in motion" title="Leadership, connection, and real conversations"/><div className="event-gallery"><img src="/assets/brand/event-community.webp" alt="Women Rise Legacy community event"/><img src="/assets/brand/event-panel.webp" alt="Women Rise Legacy panel conversation"/><img src="/assets/brand/event-keynote.webp" alt="Women Rise Legacy keynote"/></div></div></section>

    <section className="section"><div className="container"><div className="section-row"><SectionHeading eyebrow="Upcoming events" title="Connect in rooms designed for growth" text="Join leadership conversations, networking events, workshops, and community gatherings."/><Link className="button ghost" to="/events">View all events</Link></div><div className="event-card-grid">{events.length ? events.map(event => <article className="event-card" key={event.id}><img src={event.image_url || '/assets/brand/event-founder.webp'} alt=""/><div><span className="badge"><CalendarDays size={14}/>{new Date(event.start_at).toLocaleDateString()}</span><h3>{event.title}</h3><p>{event.location}</p><Link className="text-link" to="/events">Event details <ArrowRight size={16}/></Link></div></article>) : <div className="empty compact"><p>Upcoming events will appear after Phase 2 SQL is installed.</p></div>}</div></div></section>

    <section className="section alt"><div className="container"><SectionHeading eyebrow="Act where it matters" title="Help meet a verified need" text="The Foundation connects generosity with carefully reviewed family and community requests."/><div className="card-grid">{needs.map(item => <NeedCard key={item.id} item={item}/>)}</div><div className="hero-actions"><Link className="button ghost" to="/current-needs">View all current needs</Link></div></div></section>

    <section className="section"><div className="container"><SectionHeading eyebrow="Featured campaigns" title="Fund long-term and emergency response" text="Support focused campaigns for education, family care, women’s empowerment, and disaster relief."/><div className="card-grid">{campaigns.map(item => <CampaignCard key={item.id} item={item}/>)}</div></div></section>

    {stories.length > 0 && <section className="section alt"><div className="container"><SectionHeading centered eyebrow="Living legacies" title="Member stories worth sharing"/><div className="story-grid">{stories.map(story => <article className="story-card" key={story.id}><img src={story.image_url || '/assets/brand/event-community.webp'} alt=""/><div><span>{story.achievement}</span><h3>{story.title}</h3><p>{story.story.slice(0, 150)}…</p></div></article>)}</div><div className="hero-actions"><Link className="button ghost" to="/success-stories">Read success stories</Link></div></div></section>}

    <section className="section"><div className="container"><div className="cta legacy-cta"><div><span className="eyebrow">Your next chapter starts here</span><h2>Join a network built for women who are ready to heal, build, lead, and leave a legacy.</h2><p>Become a member, find a mentor, list your business, volunteer, or support a verified humanitarian need.</p></div><div className="cta-actions"><Link className="button" to="/membership">Explore membership</Link><Link className="button secondary" to="/get-involved">Make an impact</Link></div></div></div></section>
  </>;
}
