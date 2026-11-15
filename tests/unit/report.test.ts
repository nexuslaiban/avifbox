import { describe, expect, it } from 'vitest';
import { reportHref } from '../../src/ui/report';

const BROWSER = 'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0';
const DAMAGED = 'Could not decode this file. It may be damaged, or use a feature this browser does not support.';
const MEMORY = 'This image needs more memory than this device can give the browser.';

/** A `mailto:` address taken apart the way a mail program does it. */
function draft(href: string) {
  const [to, query = ''] = href.replace(/^mailto:/, '').split('?');
  const fields = Object.fromEntries(query.split('&').map((field) => field.split('=').map(decodeURIComponent)));
  return { to, subject: fields.subject as string, lines: ((fields.body as string) ?? '').split('\r\n') };
}

describe('the address of a failure report', () => {
  it('AC-49 is an email to the site that names the page, the error and the browser, and nothing else', () => {
    const href = reportHref('/avif-to-png', [DAMAGED], BROWSER);

    expect(href).toMatch(/^mailto:hello@avifbox\.com\?subject=[^&]+&body=[^&]+$/);
    // Escaped all the way: a space or a line break would cut the address short.
    expect(href).not.toMatch(/[\s"<>]/);
    expect(draft(href)).toEqual({
      to: 'hello@avifbox.com',
      subject: 'AVIFBox problem report: /avif-to-png',
      lines: [
        'What were you doing when it failed? Attach the image only if you are happy to share it.',
        '',
        'Page: https://avifbox.com/avif-to-png',
        `Error: ${DAMAGED}`,
        `Browser: ${BROWSER}`,
      ],
    });
  });

  it('AC-49 gives each different error once, in the order they happened', () => {
    const { lines } = draft(reportHref('/', [DAMAGED, MEMORY, DAMAGED], BROWSER));

    expect(lines.filter((line) => line.startsWith('Error: '))).toEqual([`Error: ${DAMAGED}`, `Error: ${MEMORY}`]);
    expect(lines).toContain('Page: https://avifbox.com/');
  });
});
