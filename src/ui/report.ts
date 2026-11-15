import { SITE } from '../content/identity';

/**
 * Where "report a failure" leads: a draft in the visitor's own mail program, which they read before it
 * leaves. It holds what it takes to reproduce the failure and nothing about the file — what a file is
 * called is the visitor's business.
 */
export function reportHref(page: string, errors: string[], browser: string): string {
  const lines = [
    'What were you doing when it failed? Attach the image only if you are happy to share it.',
    '',
    `Page: ${SITE.url}${page}`,
    ...[...new Set(errors)].map((error) => `Error: ${error}`),
    `Browser: ${browser}`,
  ];
  const subject = encodeURIComponent(`AVIFBox problem report: ${page}`);
  return `mailto:${SITE.email}?subject=${subject}&body=${encodeURIComponent(lines.join('\r\n'))}`;
}
