import { SITE } from './site';
import type { Faq } from './types';

const plain = (html: string): string => html.replace(/<[^>]+>/g, '');

export function faqSchema(entries: Faq[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: plain(entry.answer) },
    })),
  };
}

export function articleSchema(page: { path: string; headline: string; description: string; published: string }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.headline,
    description: page.description,
    url: `${SITE.url}${page.path}`,
    datePublished: page.published,
    dateModified: page.published,
    author: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
  };
}

export { plain };
