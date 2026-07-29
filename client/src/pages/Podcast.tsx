import { CalendarDays, Clock3, ExternalLink, Headphones, Mic2, PlayCircle, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Empty, ErrorBox, Loader, PageHero, SectionHeading } from '../components/UI';
import { Seo } from '../components/Seo';
import { api } from '../lib/api';
import { useWebsiteContent } from '../hooks/useWebsiteContent';
import type { PodcastEpisode } from '../types';

export function Podcast(){
  const [episodes,setEpisodes]=useState<PodcastEpisode[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('');
  const content=useWebsiteContent('page.podcast',{seoTitle:'Women Rise Legacy Podcast',seoDescription:'Leadership, mentorship, entrepreneurship, healing, and legacy conversations from Women Rise Legacy.',eyebrow:'Women Rise Legacy Podcast',title:'Conversations that help women heal, build, lead, and leave a legacy',heroText:'Listen to mentors, founders, leaders, and community voices share practical guidance and stories worth carrying forward.',searchPlaceholder:'Search episodes or guests',allCategoriesLabel:'All categories',emptyTitle:'No podcast episodes published yet',emptyText:'New conversations will appear here when the team publishes them.',listenLabel:'Listen to episode',newLabel:'New'});
  useEffect(()=>{api<PodcastEpisode[]>('/phase4/podcast').then(setEpisodes).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
  const categories=useMemo(()=>Array.from(new Map(episodes.filter(item=>item.category).map(item=>[item.category!.slug,item.category!.name])).entries()),[episodes]);
  const filtered=episodes.filter(item=>(!category||item.category?.slug===category)&&`${item.title} ${item.short_description} ${item.guest?.name||item.guest_name||''}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <Seo title={content.seoTitle} description={content.seoDescription}/>
    <PageHero eyebrow={content.eyebrow} title={content.title} text={content.heroText}/>
    <section className="section"><div className="container">
      <div className="filter-bar multiple"><div><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={content.searchPlaceholder}/></div><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">{content.allCategoriesLabel}</option>{categories.map(([slug,name])=><option value={slug} key={slug}>{name}</option>)}</select></div>
      {loading&&<Loader/>}{error&&<ErrorBox message={error}/>} {!loading&&!error&&!filtered.length&&<Empty title={content.emptyTitle} text={content.emptyText}/>}
      <div className="podcast-grid podcast-list-grid">{filtered.map(episode=><Link className="podcast-card" to={`/podcast/${episode.slug}`} key={episode.id}><img src={episode.cover_image_url||'/assets/brand/event-panel.webp'} alt=""/><div><span className="eyebrow">Episode {episode.episode_number||content.newLabel}{episode.category?.name?` · ${episode.category.name}`:''}</span><h2>{episode.title}</h2><p>{episode.short_description}</p><div className="podcast-meta">{episode.publish_at&&<span><CalendarDays/> {new Date(episode.publish_at).toLocaleDateString()}</span>}{episode.duration_minutes&&<span><Clock3/> {episode.duration_minutes} min</span>}</div><span className="text-link"><PlayCircle/>{content.listenLabel}</span></div></Link>)}</div>
    </div></section>
  </>;
}

export function PodcastDetail(){
  const {slug}=useParams();
  const [episode,setEpisode]=useState<PodcastEpisode|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{api<PodcastEpisode>(`/phase4/podcast/${slug}`).then(setEpisode).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[slug]);
  if(loading)return <div className="page-center"><Loader/></div>;
  if(error||!episode)return <div className="page-center"><ErrorBox message={error||'Podcast episode was not found.'}/></div>;
  const guest=episode.guest;
  return <>
    <Seo title={episode.seo_title||episode.title} description={episode.seo_description||episode.short_description}/>
    <section className="podcast-detail-hero"><div className="container split"><div><span className="eyebrow">Episode {episode.episode_number||'New'}{episode.category?.name?` · ${episode.category.name}`:''}</span><h1>{episode.title}</h1><p>{episode.short_description}</p><div className="podcast-meta">{episode.publish_at&&<span><CalendarDays/> {new Date(episode.publish_at).toLocaleDateString()}</span>}{episode.duration_minutes&&<span><Clock3/> {episode.duration_minutes} minutes</span>}</div><div className="hero-actions">{episode.audio_url&&<a className="button" href={episode.audio_url} target="_blank" rel="noreferrer"><Headphones/>Listen to audio</a>}{episode.youtube_url&&<a className="button secondary" href={episode.youtube_url} target="_blank" rel="noreferrer">YouTube <ExternalLink/></a>}{episode.spotify_url&&<a className="button ghost" href={episode.spotify_url} target="_blank" rel="noreferrer">Spotify <ExternalLink/></a>}{episode.apple_podcasts_url&&<a className="button ghost" href={episode.apple_podcasts_url} target="_blank" rel="noreferrer">Apple Podcasts <ExternalLink/></a>}</div></div><img className="image-rounded podcast-cover-large" src={episode.cover_image_url||'/assets/brand/event-panel.webp'} alt=""/></div></section>
    <section className="section"><div className="container podcast-detail-layout"><article className="podcast-show-notes"><SectionHeading eyebrow="Episode notes" title="What this conversation covers"/><div className="rich-copy">{episode.show_notes.split(/\n\n+/).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div>{episode.audio_url&&<audio controls src={episode.audio_url} className="podcast-audio-player"/>}</article><aside className="podcast-guest-card"><Mic2/><span className="eyebrow">Featured guest</span><img src={guest?.image_url||guest?.mentor?.avatar_url||'/assets/brand/founder.webp'} alt=""/><h3>{guest?.name||episode.guest_name||'Women Rise Legacy Guest'}</h3><p className="member-headline">{guest?.designation||episode.guest_designation}</p>{guest?.bio&&<p>{guest.bio}</p>}{guest?.mentor&&<Link className="button ghost" to="/mentors">View mentor directory</Link>}{guest?.website_url&&<a className="text-link" href={guest.website_url} target="_blank" rel="noreferrer">Guest website <ExternalLink/></a>}</aside></div></section>
  </>;
}
