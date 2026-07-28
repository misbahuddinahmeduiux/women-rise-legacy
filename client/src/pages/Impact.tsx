import { Download, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Empty, ErrorBox, Loader, PageHero, SectionHeading } from '../components/UI';
import { api } from '../lib/api';
import type { CountryServed, ImpactReport, ImpactStory } from '../types';

function GlobalImpactMap({ countries }: { countries: CountryServed[] }) {
  const [selected, setSelected] = useState<CountryServed | null>(countries[0] ?? null);
  const markers = useMemo(() => countries.filter((item) => item.latitude !== null && item.longitude !== null), [countries]);
  return <div className="impact-map-layout">
    <div className="impact-map" role="img" aria-label="Interactive map showing countries served">
      <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
        <rect width="1000" height="500" rx="28" className="map-ocean"/>
        <path className="map-land" d="M90 120l90-55 110 25 62 75-34 73-82 22-48 66-76-45-58-92zM355 75l126-30 87 43-20 72-68 23-43 89-54-50-46-77zM472 284l54-48 66 20 32 90-42 112-64-29-26-79zM594 96l105-48 139 34 86 83-35 65-105-8-49 65-85-31-40-78zM704 310l92-33 102 58-26 78-99 22-77-53z"/>
        {markers.map((item) => {
          const x = ((Number(item.longitude) + 180) / 360) * 1000;
          const y = ((90 - Number(item.latitude)) / 180) * 500;
          const active = selected?.id === item.id;
          return <g key={item.id} role="button" tabIndex={0} className="map-marker" onClick={() => setSelected(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(item); }}>
            <circle cx={x} cy={y} r={active ? 17 : 13} className={active ? 'marker-ring active' : 'marker-ring'}/>
            <circle cx={x} cy={y} r="6" className="marker-dot"/>
            <text x={x + 13} y={y - 12}>{item.country}</text>
          </g>;
        })}
      </svg>
    </div>
    <aside className="map-detail">
      {selected ? <><span className="feature-icon"><MapPin/></span><h3>{selected.country}</h3><p>{selected.description || 'Active humanitarian and community partnerships.'}</p><div className="need-count"><b>{selected.communities_count}</b> communities currently represented</div></> : <p>Select a map marker to view details.</p>}
    </aside>
  </div>;
}

export default function Impact() {
  const [stories, setStories] = useState<ImpactStory[]>([]);
  const [reports, setReports] = useState<ImpactReport[]>([]);
  const [countries, setCountries] = useState<CountryServed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([
      api<ImpactStory[]>('/public/impact-stories'),
      api<ImpactReport[]>('/public/impact-reports'),
      api<CountryServed[]>('/public/countries-served')
    ]).then(([storyData, reportData, countryData]) => { setStories(storyData); setReports(reportData); setCountries(countryData); }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);
  return <>
    <PageHero eyebrow="Impact and accountability" title="See where support goes and what it achieves" text="Explore countries served, consent-based impact stories, and public reports covering people supported, items distributed, and funds used."/>
    <section className="section"><div className="container">{loading ? <Loader/> : error ? <ErrorBox message={error}/> : <>
      <SectionHeading eyebrow="Global reach" title="Communities connected through trusted partners" text="Select a marker to view current country-level activity. Exact beneficiary addresses are never shown."/>
      {countries.length ? <GlobalImpactMap countries={countries}/> : <Empty title="Map data is not published yet" text="Countries served will appear after administrator review."/>}
    </>}</div></section>
    <section className="section alt"><div className="container"><SectionHeading eyebrow="Public reporting" title="Impact reports" text="Download approved reports when a PDF is available, or review the published summary and outcome totals."/>{reports.length ? <div className="card-grid">{reports.map((report) => <article className="card" key={report.id}><img src={report.image_url || '/assets/brand/event-community.webp'} alt=""/><div className="card-body"><div className="card-meta"><span className="badge">{report.year}</span><span>{report.reporting_period}</span></div><h3>{report.report_title}</h3><p>{report.summary}</p><div className="need-count"><b>{report.people_supported}</b> people · {report.items_distributed} items · ${Number(report.funds_used).toLocaleString()} used</div>{report.pdf_url ? <a className="text-link" href={report.pdf_url} target="_blank" rel="noreferrer">Download report <Download size={16}/></a> : <small>PDF will be added after approval.</small>}</div></article>)}</div> : <Empty title="No reports published" text="Approved impact reports will appear here."/>}</div></section>
    <section className="section"><div className="container"><SectionHeading eyebrow="Stories of change" title="Responsible, consent-based updates" text="Stories focus on outcomes while limiting personal details and protecting dignity."/>{stories.length ? <div className="card-grid">{stories.map((item) => <article className="card" key={item.id}><img src={item.image_url || '/assets/brand/event-community.webp'} alt=""/><div className="card-body"><div className="card-meta"><span className="badge">{item.country}</span><span>{item.publish_date}</span></div><h3>{item.title}</h3><p>{item.story}</p><div className="need-count"><b>{item.beneficiaries_count}</b> people supported · {item.items_distributed} items distributed</div></div></article>)}</div> : <Empty title="No impact stories yet" text="Approved updates will appear here after publication."/>}</div></section>
  </>;
}
