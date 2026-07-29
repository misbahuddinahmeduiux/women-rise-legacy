import type { ReactNode } from 'react';
import { useWebsiteContent } from '../hooks/useWebsiteContent';
import { Seo } from './Seo';
import { PageHero } from './UI';

export type CmsHeroCopy = {
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  title: string;
  heroText: string;
  [key: string]: unknown;
};

export function CmsPageHero({ contentKey, fallback, children }: { contentKey: string; fallback: CmsHeroCopy; children?: ReactNode }) {
  const content = useWebsiteContent(contentKey, fallback);
  return <>
    <Seo title={String(content.seoTitle || content.title)} description={String(content.seoDescription || content.heroText)} />
    <PageHero eyebrow={String(content.eyebrow)} title={String(content.title)} text={String(content.heroText)}>{children}</PageHero>
  </>;
}
