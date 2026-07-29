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
import { Seo } from '../components/Seo';
import { api } from '../lib/api';
import type { Business, Campaign, CurrentNeed, MemberSuccessStory, NetworkEvent, PodcastEpisode } from '../types';

const defaultHeroSlides = [
  {
    eyebrow: 'Founder-led global movement',
    title: 'Where women rise together, legacies begin.',
    text: 'Women Rise Legacy connects women with mentorship, leadership opportunities, business visibility, community, and practical support—all inside one trusted ecosystem.',
    primaryLabel: 'Join the network',
    primaryTo: '/membership',
    secondaryLabel: 'Meet the founder',
    secondaryTo: '/about',
    image: '/assets/client/women-rise-founder-speaking-black.webp',
    imageAlt: 'Women Rise Legacy founder speaking at a leadership event',
    imageMode: 'cover',
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
    image: '/assets/client/women-rise-conference-group.webp',
    imageAlt: 'Women Rise Legacy members together at the conference',
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
    image: '/assets/client/women-rise-community-dinner.webp',
    imageAlt: 'Women Rise Legacy members connecting at a community event',
    imageMode: 'cover',
    badgeTitle: 'Dignity-first support',
    badgeText: 'Verified needs and transparent impact',
    theme: 'impact-theme'
  }
] as const;

type HeroSlide = { eyebrow:string; title:string; text:string; primaryLabel:string; primaryTo:string; secondaryLabel:string; secondaryTo:string; image:string; imageAlt?:string; imageMode?:string; badgeTitle?:string; badgeText?:string; theme?:string };
const defaultFounder = { eyebrow:'Founder-led movement', title:'Built to help women turn healing into leadership', text:'Women Rise Legacy brings community, mentorship, education, enterprise, and humanitarian service into one trusted ecosystem.', image:'/assets/client/women-rise-founder-portrait.webp', imageAlt:'Founder of Women Rise Legacy Network', buttonLabel:'Read our story', buttonTo:'/about' };
const defaultCta = { eyebrow:'Your next chapter starts here', title:'Join a network built for women who are ready to heal, build, lead, and leave a legacy.', text:'Become a member, find a mentor, list your business, volunteer, or support a verified humanitarian need.', primaryLabel:'Explore membership', primaryTo:'/membership', secondaryLabel:'Make an impact', secondaryTo:'/get-involved' };
const defaultGallery = { eyebrow:'A community in motion', title:'Leadership, connection, and real conversations', images:[{url:'/assets/client/women-rise-founder-brand-backdrop.webp',alt:'Women Rise Legacy founder beside the official brand backdrop'},{url:'/assets/client/women-rise-founder-speaking-beige.webp',alt:'Women Rise Legacy founder speaking on stage'},{url:'/assets/client/women-rise-conference-group.webp',alt:'Women Rise Legacy members at the conference'}] };
const defaultSections = {
  seoTitle:'Women Rise Legacy Network',seoDescription:'A women-led network for mentorship, leadership, business visibility, community connection, and humanitarian impact.',
  trustItems:[{icon:'shield',text:'Verified community'},{icon:'heart',text:'Dignity-first support'},{icon:'network',text:'Global connections'}],
  statsLabels:{members:'Network members',businesses:'Women-led businesses',activeNeeds:'Active needs',beneficiaries:'People supported'},
  founderClosingText:'Members are encouraged to grow personally, lead professionally, build sustainable ventures, and use their influence to create opportunity for other women and families.',
  founderPillars:[{icon:'sparkles',title:'Empower',text:'Build confidence and clarity.'},{icon:'hand',title:'Support',text:'Access practical community care.'},{icon:'education',title:'Educate',text:'Learn skills that move careers forward.'},{icon:'crown',title:'Lead',text:'Step into visible, values-led leadership.'}],
  pathways:{eyebrow:'One ecosystem, multiple pathways',title:'Grow your network and your impact',text:'Choose the pathway that meets you where you are today and supports where you want to go next.',items:[{icon:'crown',title:'Membership',text:'Rise, Legacy, and Elite pathways for connection, visibility, resources, and leadership growth.',to:'/membership'},{icon:'users',title:'Mentorship',text:'Browse trusted mentors and submit a guided request based on your goals and preferred topics.',to:'/mentors'},{icon:'building',title:'Business Directory',text:'Discover women-owned businesses, professional services, and member-led brands.',to:'/businesses'},{icon:'award',title:'Opportunities',text:'Explore jobs, grants, scholarships, speaking opportunities, vendor events, and conferences.',to:'/opportunities'}]},
  businesses:{eyebrow:'Women-owned enterprise',title:'Featured businesses',text:'Meet members turning expertise, creativity, and resilience into growing brands.',buttonLabel:'Browse directory',emptyText:'Featured businesses will appear here after they are published.'},
  events:{eyebrow:'Upcoming events',title:'Connect in rooms designed for growth',text:'Join leadership conversations, networking events, workshops, and community gatherings.',buttonLabel:'View all events',detailLabel:'Event details',emptyText:'Upcoming events will appear here after they are published.'},
  needs:{eyebrow:'Act where it matters',title:'Help meet a verified need',text:'The Foundation connects generosity with carefully reviewed family and community requests.',buttonLabel:'View all current needs'},
  campaigns:{eyebrow:'Featured campaigns',title:'Fund long-term and emergency response',text:'Support focused campaigns for education, family care, women’s empowerment, and disaster relief.'},
  stories:{eyebrow:'Living legacies',title:'Member stories worth sharing',buttonLabel:'Read success stories'},
  podcast:{eyebrow:'Women Rise Legacy Podcast',title:'Conversations that guide, inspire, and connect',text:'Hear practical insight from mentors, founders, leaders, and women building meaningful legacies.',buttonLabel:'All episodes',listenLabel:'Listen now',newEpisodeLabel:'New'}
};
const homeIcons:Record<string,any>={shield:ShieldCheck,heart:Heart,network:Network,sparkles:Sparkles,hand:HandHeart,education:GraduationCap,crown:Crown,users:Users,building:Building2,award:Award};

export default function Home() {
  const [needs, setNeeds] = useState<CurrentNeed[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [stories, setStories] = useState<MemberSuccessStory[]>([]);
  const [podcasts, setPodcasts] = useState<PodcastEpisode[]>([]);
  const [slides, setSlides] = useState<HeroSlide[]>(defaultHeroSlides as unknown as HeroSlide[]);
  const [founderContent, setFounderContent] = useState(defaultFounder);
  const [ctaContent, setCtaContent] = useState(defaultCta);
  const [galleryContent, setGalleryContent] = useState(defaultGallery);
  const [sections, setSections] = useState(defaultSections);
  const [activeSlide, setActiveSlide] = useState(0);
  const [sliderPaused, setSliderPaused] = useState(false);
  const [stats, setStats] = useState({ activeNeeds: 0, campaigns: 0, beneficiaries: 0, itemsDistributed: 0, members: 0, businesses: 0 });

  useEffect(() => {
    Promise.all([
      api<CurrentNeed[]>('/public/current-needs'), api<Campaign[]>('/public/campaigns'), api<typeof stats>('/public/stats'),
      api<Business[]>('/public/businesses?featured=true'), api<NetworkEvent[]>('/public/events?upcoming=true'), api<MemberSuccessStory[]>('/public/member-success-stories'),
      api<Record<string, any>>('/phase4/content'), api<PodcastEpisode[]>('/phase4/podcast?limit=3')
    ]).then(([n, c, s, b, e, st, content, podcastItems]) => {
      setNeeds(n.slice(0, 3));
      setCampaigns(c.slice(0, 3));
      setStats(s);
      setBusinesses(b.slice(0, 3));
      setEvents(e.slice(0, 3));
      setStories(st.slice(0, 3));
      setPodcasts(podcastItems.slice(0, 3));
      const configuredSlides = content['homepage.hero']?.slides;
      if (Array.isArray(configuredSlides) && configuredSlides.length) {
        setSlides(configuredSlides.map((item:any,index:number)=>({
          ...defaultHeroSlides[Math.min(index, defaultHeroSlides.length - 1)],
          ...item,
          imageAlt:item.imageAlt||item.title,
          imageMode:item.imageMode||'cover',
          theme:item.theme||['founder-theme','network-theme','impact-theme'][index%3]
        })));
      }
      if (content['homepage.founder']) setFounderContent({...defaultFounder,...content['homepage.founder']});
      if (content['homepage.cta']) setCtaContent({...defaultCta,...content['homepage.cta']});
      if (content['homepage.gallery']) setGalleryContent({...defaultGallery,...content['homepage.gallery'],images:Array.isArray(content['homepage.gallery'].images)?content['homepage.gallery'].images:defaultGallery.images});
      if (content['homepage.sections']) setSections({...defaultSections,...content['homepage.sections'],statsLabels:{...defaultSections.statsLabels,...content['homepage.sections'].statsLabels},pathways:{...defaultSections.pathways,...content['homepage.sections'].pathways,items:Array.isArray(content['homepage.sections'].pathways?.items)?content['homepage.sections'].pathways.items:defaultSections.pathways.items},businesses:{...defaultSections.businesses,...content['homepage.sections'].businesses},events:{...defaultSections.events,...content['homepage.sections'].events},needs:{...defaultSections.needs,...content['homepage.sections'].needs},campaigns:{...defaultSections.campaigns,...content['homepage.sections'].campaigns},stories:{...defaultSections.stories,...content['homepage.sections'].stories},podcast:{...defaultSections.podcast,...content['homepage.sections'].podcast},trustItems:Array.isArray(content['homepage.sections'].trustItems)?content['homepage.sections'].trustItems:defaultSections.trustItems,founderPillars:Array.isArray(content['homepage.sections'].founderPillars)?content['homepage.sections'].founderPillars:defaultSections.founderPillars});
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (sliderPaused) return undefined;
    const timer = window.setInterval(() => {
      setActiveSlide(current => (current + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [sliderPaused, slides.length]);

  const slide = slides[activeSlide] || slides[0] || defaultHeroSlides[0];
  const showPrevious = () => setActiveSlide(current => (current - 1 + slides.length) % slides.length);
  const showNext = () => setActiveSlide(current => (current + 1) % slides.length);

  return <>
    <Seo title={sections.seoTitle} description={sections.seoDescription}/>
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
          <div className="trust-row">{sections.trustItems.map((item:any)=>{const Icon=homeIcons[item.icon]||ShieldCheck;return <span key={item.text}><Icon size={18}/>{item.text}</span>})}</div>
        </div>

        <div className="hero-visual brand-visual">
          <div className="hero-slider-frame">
            {slides.map((item, index) => <div
              className={`hero-slide-image ${index === activeSlide ? 'active' : ''} ${item.imageMode === 'founder' ? 'founder-image-slide' : 'cover-image-slide'}`}
              key={item.image}
              aria-hidden={index !== activeSlide}
            >
              <img src={item.image} alt={index === activeSlide ? item.imageAlt : ''} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async"/>
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
            {slides.map((item, index) => <button
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

    <div className="container stats brand-stats"><div className="stat"><strong>{stats.members}+</strong><span>{sections.statsLabels.members}</span></div><div className="stat"><strong>{stats.businesses}+</strong><span>{sections.statsLabels.businesses}</span></div><div className="stat"><strong>{stats.activeNeeds}+</strong><span>{sections.statsLabels.activeNeeds}</span></div><div className="stat"><strong>{stats.beneficiaries}+</strong><span>{sections.statsLabels.beneficiaries}</span></div></div>

    <section className="section"><div className="container split founder-section"><div className="founder-portrait-wrap"><div className="portrait-halo"/><img className="founder-portrait" src={founderContent.image} alt={founderContent.imageAlt||'Founder of Women Rise Legacy Network'} loading="lazy" decoding="async"/></div><div><SectionHeading eyebrow={founderContent.eyebrow} title={founderContent.title} text={founderContent.text}/><p>{sections.founderClosingText}</p><div className="pillar-mini-grid">{sections.founderPillars.map((item:any)=>{const Icon=homeIcons[item.icon]||Sparkles;return <div key={item.title}><Icon/><b>{item.title}</b><span>{item.text}</span></div>})}</div><Link className="text-link" to={founderContent.buttonTo}>{founderContent.buttonLabel} <ArrowRight size={16}/></Link></div></div></section>

    <section className="section alt"><div className="container"><SectionHeading centered eyebrow={sections.pathways.eyebrow} title={sections.pathways.title} text={sections.pathways.text}/><div className="feature-grid four">{sections.pathways.items.map((item:any)=>{const Icon=homeIcons[item.icon]||Sparkles;return <Link className="feature feature-link" to={item.to} key={item.title}><span className="feature-icon"><Icon/></span><h3>{item.title}</h3><p>{item.text}</p></Link>})}</div></div></section>

    <section className="section"><div className="container"><div className="section-row"><SectionHeading eyebrow={sections.businesses.eyebrow} title={sections.businesses.title} text={sections.businesses.text}/><Link className="button ghost" to="/businesses">{sections.businesses.buttonLabel}</Link></div><div className="business-preview-grid">{businesses.length ? businesses.map(b => <Link className="business-preview" to={`/businesses/${b.slug}`} key={b.id}><img src={b.image_url || '/assets/brand/event-community.webp'} alt=""/><div><span>{b.industry}</span><h3>{b.name}</h3><p>{b.city}, {b.country}</p></div></Link>) : <div className="empty compact"><p>{sections.businesses.emptyText}</p></div>}</div></div></section>

    {galleryContent.images.length > 0 && <section className="section media-strip"><div className="container"><SectionHeading centered eyebrow={galleryContent.eyebrow} title={galleryContent.title}/><div className="event-gallery">{galleryContent.images.map((image:any,index:number)=><img src={image.url} alt={image.alt||''} key={`${image.url}-${index}`} loading="lazy" decoding="async"/>)}</div></div></section>}

    <section className="section"><div className="container"><div className="section-row"><SectionHeading eyebrow={sections.events.eyebrow} title={sections.events.title} text={sections.events.text}/><Link className="button ghost" to="/events">{sections.events.buttonLabel}</Link></div><div className="event-card-grid">{events.length ? events.map(event => <article className="event-card" key={event.id}><img src={event.image_url || '/assets/brand/event-founder.webp'} alt=""/><div><span className="badge"><CalendarDays size={14}/>{new Date(event.start_at).toLocaleDateString()}</span><h3>{event.title}</h3><p>{event.location}</p><Link className="text-link" to="/events">{sections.events.detailLabel} <ArrowRight size={16}/></Link></div></article>) : <div className="empty compact"><p>{sections.events.emptyText}</p></div>}</div></div></section>

    <section className="section alt"><div className="container"><SectionHeading eyebrow={sections.needs.eyebrow} title={sections.needs.title} text={sections.needs.text}/><div className="card-grid">{needs.map(item => <NeedCard key={item.id} item={item}/>)}</div><div className="hero-actions"><Link className="button ghost" to="/current-needs">{sections.needs.buttonLabel}</Link></div></div></section>

    <section className="section"><div className="container"><SectionHeading eyebrow={sections.campaigns.eyebrow} title={sections.campaigns.title} text={sections.campaigns.text}/><div className="card-grid">{campaigns.map(item => <CampaignCard key={item.id} item={item}/>)}</div></div></section>

    {stories.length > 0 && <section className="section alt"><div className="container"><SectionHeading centered eyebrow={sections.stories.eyebrow} title={sections.stories.title}/><div className="story-grid">{stories.map(story => <article className="story-card" key={story.id}><img src={story.image_url || '/assets/brand/event-community.webp'} alt=""/><div><span>{story.achievement}</span><h3>{story.title}</h3><p>{story.story.slice(0, 150)}…</p></div></article>)}</div><div className="hero-actions"><Link className="button ghost" to="/success-stories">{sections.stories.buttonLabel}</Link></div></div></section>}

    {podcasts.length > 0 && <section className="section podcast-home-section"><div className="container"><div className="section-row"><SectionHeading eyebrow={sections.podcast.eyebrow} title={sections.podcast.title} text={sections.podcast.text}/><Link className="button ghost" to="/podcast">{sections.podcast.buttonLabel}</Link></div><div className="podcast-grid">{podcasts.map(episode=><Link className="podcast-card" to={`/podcast/${episode.slug}`} key={episode.id}><img src={episode.cover_image_url||'/assets/brand/event-panel.webp'} alt=""/><div><span className="eyebrow">Episode {episode.episode_number||sections.podcast.newEpisodeLabel}</span><h3>{episode.title}</h3><p>{episode.short_description}</p><span className="text-link">{sections.podcast.listenLabel} <ArrowRight size={16}/></span></div></Link>)}</div></div></section>}

    <section className="section legacy-cta-section"><div className="container"><div className="cta legacy-cta"><div className="legacy-cta-copy"><span className="eyebrow">{ctaContent.eyebrow}</span><h2>{ctaContent.title}</h2><p>{ctaContent.text}</p><div className="legacy-cta-highlights" aria-label="Membership benefits"><span><Users size={17}/> Trusted community</span><span><GraduationCap size={17}/> Mentorship and growth</span><span><HandHeart size={17}/> Meaningful impact</span></div></div><div className="legacy-cta-action-card"><div className="legacy-cta-action-heading"><span className="legacy-cta-action-icon"><Sparkles size={20}/></span><div><small>Choose your pathway</small><strong>Take the next step with confidence</strong></div></div><div className="cta-actions"><Link className="button legacy-cta-primary" to={ctaContent.primaryTo}>{ctaContent.primaryLabel}<ArrowRight size={18}/></Link><Link className="button secondary legacy-cta-secondary" to={ctaContent.secondaryTo}>{ctaContent.secondaryLabel}<ArrowRight size={18}/></Link></div><p className="legacy-cta-note">Explore the option that best matches your goals today.</p></div></div></div></section>
  </>;
}
