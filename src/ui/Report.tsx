import { SITE } from '../content/identity';
import { reportHref } from './report';

/**
 * Shown next to a failure. The site has no analytics and no error reporting, so this line is the only
 * way a failure in somebody's browser is ever heard of. The address is spelled out for a visitor whose
 * browser has no mail program to open.
 */
export function Report({ errors }: { errors: string[] }) {
  return (
    <p class="cv-note cv-report">
      Should this have worked?{' '}
      <a href={reportHref(location.pathname, errors, navigator.userAgent)}>Email {SITE.email}</a> — the draft names the
      error and your browser, not your file.
    </p>
  );
}
