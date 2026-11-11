import { SITE } from './site';
import type { Faq } from './types';

const plain = (html: string): string => html.replace(/<[^>]+>/g, '');

/** The publisher of the site as one entity: every block that names it uses this `@id`. */
const publisher = {
  '@type': 'Organization',
  '@id': `${SITE.url}/#organization`,
  name: SITE.name,
  url: SITE.url,
};

export const ORGANIZATION: object = {
  '@context': 'https://schema.org',
  ...publisher,
  logo: `${SITE.url}/logo.png`,
};

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

/** A free converter that runs in the browser, living at `path`. */
export function appSchema(app: { name: string; path: string; description: string; features: string[] }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.name,
    url: `${SITE.url}${app.path}`,
    description: app.description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any — runs in the web browser',
    browserRequirements: 'Requires JavaScript and a current version of Chrome, Edge, Firefox or Safari',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: app.features,
  };
}

export function articleSchema(page: {
  path: string;
  headline: string;
  description: string;
  published: string;
  updated: string;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.headline,
    description: page.description,
    url: `${SITE.url}${page.path}`,
    datePublished: page.published,
    dateModified: page.updated,
    author: publisher,
    publisher,
  };
}

export { plain };
