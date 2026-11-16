# AVIFBox — the site says where its source is

Date: 2026-11-16 · Source: the owner published the repository on 2026-11-16 as
`github.com/nexuslaiban/avifbox`, under AGPL-3.0-only. Builds on the five earlier specs; AC numbers
continue from them (AC-01…50 are unchanged unless listed under "Existing behaviour changed").

## Change

1. **`/about` links to the source code** (AC-51). The page tells a visitor not to take "nothing is
   uploaded" on trust, and names two ways to check: the page's security policy and the browser's
   network panel. Since 2026-11-16 there is a third, reading the code, and the site does not mention
   it.

Out of scope: the link on any other page or in the footer, `sameAs` in the `Organization` data,
`llms.txt`, a licence notice on the site.

## Existing behaviour changed

- `/about`, under "How it works", gains a paragraph after "You need not take this on trust…": "The
  code this site is built from is public as well, at github.com/nexuslaiban/avifbox, under the
  AGPL-3.0 licence." The address is the link.
- The registry of external links (`src/content/sources.ts`) gains the repository, so AC-30 covers the
  new link with no change to its test.

## Acceptance criteria

`E` = Playwright against the built site, `O` = observed and recorded below.

- **AC-51** (E, O) Given `/about`, then the section "How it works" holds exactly one link to
  `https://github.com/nexuslaiban/avifbox`, the link's text is that address without the scheme, and
  the sentence around it reads "…is public as well, at github.com/nexuslaiban/avifbox, under the
  AGPL-3.0 licence." with its words apart. The address is a registered source (E). The address answers
  without signing in, and GitHub names the repository's licence as AGPL-3.0 (O). After the deploy the
  live check passes (O).

## Decisions worth recording

- **A sentence where the page already argues for trust, not a section of its own.** "How it works"
  ends by saying how to check the claim. The code is one more way to check it, and belongs there.
- **The address is the link's text**, as with the email address: it can be read and copied, and
  whoever quotes the page quotes where the code is.
- **Only `/about`.** A link in the footer would put another site's address on all thirteen pages. That
  is a different decision from saying once, where it matters, that the code can be read.

## Approval

Approved by the owner on 2026-11-16, in reply to the proposal to add this link to `/about`. Committed
to `main` once its tests are green, then deployed with `pnpm run deploy`.

## Observed
