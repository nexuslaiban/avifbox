// Compares a deployed site with the build it was deployed from: every file, every header of `_headers`.
// Pure: the build and the way to ask the site are handed in (`verify-live.ts` does that).

/** What the check needs from `fetch`: one request, redirects not followed. */
export type Fetch = (url: string) => Promise<Response>;

export interface Report {
  origin: string;
  /** How many files and how many headers were compared with the build. */
  files: number;
  headers: number;
  failures: string[];
}

/** `_headers` as path pattern → header → value. */
export type Rules = Record<string, Record<string, string>>;

/** A path no page of the site has: what answers there must be the 404 page. */
const NOWHERE = '/no-such-page-for-the-live-check';

export function parseHeaders(text: string): Rules {
  const rules: Rules = {};
  let pattern = '';
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    // A pattern starts its line; the headers under it are indented.
    if (!/^\s/.test(line)) {
      pattern = line.trim();
      rules[pattern] = {};
      continue;
    }
    const colon = line.indexOf(':');
    rules[pattern][line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return rules;
}

/** Where the host serves a file of the build, and with which status. */
function address(file: string): { path: string; status: number } {
  if (file === 'index.html') return { path: '/', status: 200 };
  if (file === '404.html') return { path: NOWHERE, status: 404 };
  return { path: `/${file.replace(/\.html$/, '')}`, status: 200 };
}

/** `*` stands for any run of characters, as the host reads it. */
function matches(pattern: string, path: string): boolean {
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${pattern.split('*').map(literal).join('.*')}$`).test(path);
}

async function fileFailure(response: Response, built: Uint8Array, status: number): Promise<string | null> {
  if (response.status !== status) return `answered ${response.status}, expected ${status}`;
  const served = new Uint8Array(await response.arrayBuffer());
  let at = 0;
  while (at < built.length && served[at] === built[at]) at++;
  if (at === built.length && served.length === built.length) return null;
  return `differs from the build (${served.length} bytes served, ${built.length} built; the first difference is at byte ${at})`;
}

function headerFailure(response: Response, name: string, want: string): string | null {
  const got = response.headers.get(name);
  if (got === want) return null;
  return `${name} is ${got === null ? 'missing' : JSON.stringify(got)}, _headers says ${JSON.stringify(want)}`;
}

/** Plain HTTP must lead to the same address over HTTPS: HSTS only binds a browser that has been there. */
async function redirectFailure(origin: string, fetch: Fetch): Promise<string | null> {
  const response = await fetch(`${origin.replace(/^https:/, 'http:')}/`);
  const to = response.headers.get('location');
  if (![301, 308].includes(response.status) || !to)
    return `answered ${response.status}, expected a redirect to ${origin}/`;
  return to === `${origin}/` ? null : `redirects to ${to}, expected ${origin}/`;
}

/**
 * Asks the site for every file of the build and compares what comes back. `build` is `dist/` as
 * path → bytes, `_headers` included. A check that could compare nothing is a failure, not a pass.
 */
export async function checkSite(build: Map<string, Uint8Array>, fetch: Fetch): Promise<Report> {
  const report: Report = { origin: '', files: 0, headers: 0, failures: [] };
  const text = (file: string) => new TextDecoder().decode(build.get(file) ?? new Uint8Array());
  // The build knows where it lives, so the address is not written down a third time here.
  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(text('index.html'))?.[1];
  if (!canonical) {
    report.failures.push('index.html names no canonical address: nothing was checked');
    return report;
  }
  report.origin = new URL(canonical).origin;
  if (!build.has('_headers')) report.failures.push('the build has no _headers: no header was checked');
  const rules = Object.entries(parseHeaders(text('_headers')));
  const used = new Set<string>();

  /** Runs one part of the check; a request that fails is a failure of that part, not the end of the run. */
  const check = async (what: string, problems: () => Promise<(string | null)[]>) => {
    const found = await problems().catch((error: Error) => [`no answer (${error.message})`]);
    for (const problem of found) if (problem) report.failures.push(`${what}: ${problem}`);
  };

  for (const [file, built] of build) {
    if (file === '_headers') continue; // read by the host, not served
    const { path, status } = address(file);
    await check(path, async () => {
      const response = await fetch(report.origin + path);
      report.files++;
      const expected = rules.filter(([pattern]) => matches(pattern, path));
      for (const [pattern] of expected) used.add(pattern);
      const headers = expected.flatMap(([, wanted]) => Object.entries(wanted));
      report.headers += headers.length;
      return [
        await fileFailure(response, built, status),
        ...headers.map(([name, want]) => headerFailure(response, name, want)),
      ];
    });
  }
  for (const [pattern] of rules)
    if (!used.has(pattern)) report.failures.push(`_headers: the rule for ${pattern} matches no file of the build`);
  await check(`${report.origin.replace(/^https:/, 'http:')}/`, async () => [
    await redirectFailure(report.origin, fetch),
  ]);
  return report;
}
