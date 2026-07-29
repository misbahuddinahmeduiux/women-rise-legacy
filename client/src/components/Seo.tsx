import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type GlobalSeo = { titleSuffix: string; defaultDescription: string; socialImage: string; twitterCard: string };
const defaults: GlobalSeo = { titleSuffix: 'Women Rise Legacy', defaultDescription: 'A women-led network for mentorship, leadership, business visibility, community connection, and humanitarian impact.', socialImage: '', twitterCard: 'summary_large_image' };
let globalSeoPromise: Promise<GlobalSeo> | null = null;

function loadGlobalSeo() {
  if (!globalSeoPromise) {
    globalSeoPromise = api<{ value: Partial<GlobalSeo> }>('/phase4/content/site.seo')
      .then((row) => ({ ...defaults, ...row.value }))
      .catch(() => defaults);
  }
  return globalSeoPromise;
}

export function Seo({ title, description, noIndex = false, image = '' }: { title: string; description?: string; noIndex?: boolean; image?: string }) {
  const [settings, setSettings] = useState<GlobalSeo>(defaults);
  useEffect(() => { void loadGlobalSeo().then(setSettings); }, []);
  useEffect(() => {
    const fullTitle = settings.titleSuffix && !title.toLowerCase().includes(settings.titleSuffix.toLowerCase()) ? `${title} | ${settings.titleSuffix}` : title;
    const finalDescription = description || settings.defaultDescription;
    const socialImage = image || settings.socialImage;
    document.title = fullTitle;
    setMeta('description', finalDescription);
    setMeta('robots', noIndex ? 'noindex,nofollow' : 'index,follow');
    setMeta('twitter:card', settings.twitterCard || 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', finalDescription);
    setProperty('og:title', fullTitle);
    setProperty('og:description', finalDescription);
    setProperty('og:type', 'website');
    if (socialImage) {
      const absoluteImage = /^https?:\/\//i.test(socialImage) ? socialImage : `${window.location.origin}${socialImage.startsWith('/') ? '' : '/'}${socialImage}`;
      setProperty('og:image', absoluteImage);
      setMeta('twitter:image', absoluteImage);
    }
  }, [title, description, noIndex, image, settings]);
  return null;
}

function setMeta(name: string, content: string) {
  let node = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!node) { node = document.createElement('meta'); node.name = name; document.head.appendChild(node); }
  node.content = content;
}
function setProperty(property: string, content: string) {
  let node = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!node) { node = document.createElement('meta'); node.setAttribute('property', property); document.head.appendChild(node); }
  node.content = content;
}
