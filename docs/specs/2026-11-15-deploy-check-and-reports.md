# AVIFBox — a deploy that checks itself, a header and a way to report a failure

Date: 2026-11-15 · Source: the review of 2026-11-15, which read the live response headers, the DNS
records, the dependencies and the repository. Builds on the four earlier specs; AC numbers continue
from them (AC-01…44 are unchanged unless listed under "Existing behaviour changed").

## Change

Three parts, in the order they are built.

1. **`pnpm run deploy` tests before it uploads and checks the live site after** (AC-45, AC-46, AC-47).
   Today it builds and uploads. The type check, the tests and the comparison of the live site with
   `dist/` were run by hand around every deploy so far; nothing makes the next deploy do the same.
2. **No other site can show these pages in a frame** (AC-48). No response forbids it today. The pages'
   own Content-Security-Policy sits in a `<meta>` tag, where `frame-ancestors` is ignored.
3. **A failed file comes with a way to report it** (AC-49, AC-50). The site has no analytics and no
   error reporting, on purpose. The price is that a converter which fails in some browser fails
   without the owner hearing of it. The report is an email the visitor sends from their own mail
   program.

Out of scope: a DMARC record for the domain (DNS, the owner's to add), a git remote, usage statistics,
offline use, dependency updates.

## Existing behaviour changed

- `pnpm run deploy` runs `pnpm check`, `pnpm test` and the whole E2E run, uploads, then checks the live
  site. It stops at the first step that fails, so a red test means nothing is uploaded. It takes
  about three minutes instead of seconds (the E2E run alone took 1.8 minutes on 2026-11-15). Port 4322
  must be free: the E2E step does not reuse a server that is already running, because that one may be
  serving an older build.
- New command: `pnpm verify:live`, the last step of the deploy, usable alone.
- Every response gains `X-Frame-Options: DENY`. A page of the site inside an `<iframe>` — on any site,
  this one included — stays empty. The site frames nothing itself.
- The converter shows one line under the results while at least one file has failed, and the viewer
  shows it when it cannot open a file: "Should this have worked? Email hello@avifbox.com — the draft
  names the error and your browser, not your file."
- `/privacy`, under "If you write in", gains: "When a file fails, the tool offers a link that opens a
  draft in your own mail program, with the page, the error message and your browser’s user-agent
  already written. Nothing is sent unless you send it, and your file is not attached." Its date
  becomes 2026-11-15.
- **AC-41 is amended** (on 2026-11-15, when the first deploy with the new command stopped at the E2E
  run). The seven tests whose only assertion is an axe run — AC-28 and the two of AC-34 — are skipped
  in WebKit, and the skip says why. They run in Chromium as before.

## Acceptance criteria

`E` = Playwright against the built site, `U` = Vitest, `O` = observed and recorded below.

- **AC-45** (U) Given a build, and a site that serves every file of it unchanged — `index.html` at
  `/`, `about.html` at `/about`, `404.html` with status 404 at an address that does not exist, the
  rest at their own paths — with every header of `_headers` on the paths its rules match, and plain
  HTTP redirecting to the same address over HTTPS: then the live check passes and reports how many
  files and how many headers it compared. Each of these alone makes it fail, with a message that names
  the path: a file with other bytes; a file answered with another status; a header that is missing or
  has another value (the message names the header too); the unknown address answered with 200; plain
  HTTP not redirected to HTTPS; a request that gets no answer — after which the other files are still
  checked.
- **AC-46** (U) The live check never passes on nothing. It fails, and says what was not checked, given
  a build whose home page names no canonical address (an empty build among them), a build without
  `_headers`, or a rule in `_headers` that matches no file of the build.
- **AC-47** (U, O) In `package.json`, `deploy` runs the type check, the unit tests and the E2E run
  before `wrangler deploy` and the live check after it, chained so that a step that fails stops the
  rest (U). With one unit test made to fail, `pnpm run deploy` stops there and uploads nothing (O).
  A real deploy ends with the live check passing (O).
- **AC-48** (U, O) `public/_headers` gives every path (`/*`) the header `X-Frame-Options` with the
  value `DENY` (U). After the deploy the live check passes, and a page elsewhere that frames
  `https://avifbox.com/` shows nothing in the frame (O).
- **AC-49** (U) Given a page path, the error messages of the failed files and the browser's
  user-agent, the report address is a `mailto:` to `hello@avifbox.com`. Its subject names the page.
  Its body, decoded, holds the page's address, each different error message once, and the user-agent,
  on lines of their own. Nothing else goes in: it is not given the file or its name.
- **AC-50** (E) Given `/avif-to-png` with one file that converts and one that fails, then one link
  "Email hello@avifbox.com" is shown under the results, and its address is the one of AC-49 for this
  page and that file's error. Given only files that convert, there is no such link. Given
  `/avif-viewer` and a file it cannot open, the link is shown. `/privacy` says that the link opens a
  draft in the visitor's own mail program, what is written in it, and that nothing is sent unless
  they send it; the page's date is 2026-11-15.

## Decisions worth recording

- **The whole E2E run is part of the deploy.** The unit tests cover the engine; what a hurried edit
  breaks is copy and page structure — the word limit, links, structured data — and only the E2E run
  sees those. It runs with `CI=1`, which makes Playwright build and start its own server.
- **No flag to skip the checks.** `pnpm exec wrangler deploy` still uploads `dist/` as it is; whoever
  types it knows what they left out.
- **The live check compares every file, not a sample.** It is some fifty requests and takes seconds.
  The one time the host changed a page — Cloudflare's analytics beacon — it was found by comparing
  pages with the build.
- **The live check takes the site's address from the build**, from the canonical link of the home
  page. The origin is already written down in the config, the content and `robots.txt`; this avoids
  one more.
- **No retry.** Every deploy so far matched the build at once. If one does not, that is worth seeing
  before it is papered over.
- **Written in TypeScript, run by Node as it is** (`node scripts/verify-live.ts`). Node strips the
  types from 22.18 on, below the version this project requires. So `pnpm check` covers the script and
  the unit tests import it.
- **axe does not run in WebKit.** In the first deploy the two tests that run axe on every page hung
  in WebKit, and the deploy stopped before the upload, as it should. Run again afterwards, eight of
  them at once: seven or eight hang each time, with every thread of the page asleep waiting on the
  compositor, and four minutes are not enough for them to finish. One at a time they pass. The same
  walk over every page without axe passes eight at once, and so does axe in Chromium. Leaving out the
  colour-contrast rule, or the blank page axe opens, changes nothing. The same tests passed earlier
  that day and on 2026-11-12; a desktop session with Chrome and a screen mirror had been started on
  the machine in between, and nothing more is known about the cause. A check that fails by chance
  gets bypassed, so the trigger is taken out instead of being retried. What axe checks — markup,
  names, contrast — does not depend on the engine.
- **`X-Frame-Options`, not `frame-ancestors`.** The second needs a Content-Security-Policy header on
  `/*`, which the host would join with the one `/_astro/*` already sends. The first is one line and
  every browser the site supports honours it.
- **An email, not a form and not a beacon.** Anything the page sent by itself would be the analytics
  the privacy page rules out. A draft in the visitor's mail program is read by them before it leaves.
  The file name stays out: a name is private more often than an error message is.
- **One link for the page, not one per failed file**, with the address in its text: a visitor whose
  browser has no mail program set up can still copy it.
- **The site's name and address moved to `src/content/identity.ts`** (added while building part 3).
  The link needs the address in the browser. Importing it from `site.ts` carried the navigation and
  other page copy into the script; from a file of its own, the link costs 803 bytes of script.

## Approval

TOUCHPOINT 1 — approved by the owner on 2026-11-15, all three parts, with the whole E2E run in the
deploy. Each part is committed to `main` once its tests are green. When the three are in, the site is
deployed once with the new command.

## Observed

Nothing yet.
