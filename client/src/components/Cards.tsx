import { ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Campaign, CurrentNeed, SponsorFamily } from '../types';
import { Progress } from './UI';

const fallback = '/assets/brand/event-community.webp';
export function NeedCard({ item }: { item: CurrentNeed }) {
  const remaining = Math.max(0, item.quantity_needed - item.quantity_received);
  return <article className="card"><img src={item.image_url || fallback} alt=""/><div className="card-body"><div className="card-meta"><span className={`badge ${item.urgency}`}>{item.urgency}</span><span><MapPin size={14}/>{item.country}</span></div><h3>{item.title}</h3><p>{item.description}</p><div className="need-count"><b>{remaining}</b> still needed of {item.quantity_needed}</div><Link className="text-link" to={`/current-needs/${item.slug}`}>View need <ArrowRight size={16}/></Link></div></article>;
}
export function CampaignCard({ item }: { item: Campaign }) {
  return <article className="card"><img src={item.image_url || fallback} alt=""/><div className="card-body"><div className="card-meta"><span className="badge">{item.campaign_type}</span><span><MapPin size={14}/>{item.country}</span></div><h3>{item.title}</h3><p>{item.summary}</p><Progress value={Number(item.amount_raised)} max={Number(item.funding_goal)}/><Link className="text-link" to={`/campaigns/${item.slug}`}>Support campaign <ArrowRight size={16}/></Link></div></article>;
}
export function FamilyCard({ item }: { item: SponsorFamily }) {
  return <article className="card"><img src={item.image_url || fallback} alt=""/><div className="card-body"><div className="card-meta"><span className="badge">Family of {item.family_size}</span><span><MapPin size={14}/>{item.country}</span></div><h3>{item.public_alias}</h3><p>{item.situation_summary}</p><Progress value={Number(item.amount_raised)} max={Number(item.sponsorship_goal)}/><Link className="text-link" to={`/sponsor-a-family/${item.slug}`}>View sponsorship <ArrowRight size={16}/></Link></div></article>;
}
