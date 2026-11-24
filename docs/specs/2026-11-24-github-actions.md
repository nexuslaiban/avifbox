# AVIFBox — GitHub Actions deploys the site and releases the extension

Date: 2026-11-24 · Source: the owner's question how to have GitHub build and publish by itself.
Builds on the eight earlier specs; AC numbers continue from them (AC-01…73 are unchanged unless
listed under "Existing behaviour changed").

## Change

1. **A push to `main` deploys the site** (AC-74…AC-77). The workflow `.github/workflows/deploy.yml`
   runs `pnpm run deploy` as it is, on a runner of GitHub's, with the Cloudflare token kept by GitHub
   in the environment `production`. It can also be started by hand from the Actions tab.
2. **A tag `extension-v<version>` releases the extension** (AC-78…AC-80). The workflow
   `.github/workflows/extension.yml` runs the extension's tests and attaches
   `avifbox-extension-<version>.zip`, the content of `dist-extension/`, to a GitHub Release named by
   the tag.

Out of scope: a run for pull requests or other branches (see "Decisions"), the Chrome Web Store or any other store, a version for the site,
caching Playwright's browsers, a required reviewer for deploys (a setting of the environment on
GitHub, not of the repository: see "Decisions").

## Existing behaviour changed

- A push to `main` now puts the site live when its tests pass. Before, nothing left the machine until
  someone ran `pnpm run deploy`. Work that should not go live yet goes to another branch.
- `pnpm run deploy` on a machine still works and is unchanged. Its IndexNow note is the file in that
  checkout; the runs on GitHub keep theirs in GitHub's cache (AC-77). Neither sees the other's note.
- The extension spec put "the package to upload" out of scope. A zip on a GitHub Release is now made;
  a store stays out of scope.
- `package.json`, `scripts/`, the site and the tests are not changed.

## Acceptance criteria

`L` = actionlint passes on both workflows and the file says so, `O` = observed on GitHub and recorded
below.

- **AC-74** (L, O) A push to `main`, and a start by hand (`workflow_dispatch`) on `main`, run the job
  `deploy` in the environment `production` on `ubuntu-latest`: Node 24, the pnpm that
  `packageManager` names, `pnpm install --frozen-lockfile`, Playwright's browsers with their system
  packages, then `pnpm run deploy`. Only that step is given a secret: `CLOUDFLARE_API_TOKEN`, the
  environment's secret of that name. The run's own token may only read the repository. A start by
  hand on another branch deploys nothing. A run whose commit is no longer the one `main` points at
  fails before anything is installed, and says so: a run tried again keeps its commit, and would put
  an older site live. A run fails when `pnpm run deploy` fails, and a failed run keeps Playwright's
  `test-results/` as an artifact for seven days (O: a green run whose log holds the live check's "ok"
  and IndexNow's answer).
- **AC-75** (L, O) Two deploy runs never overlap. The runs of a branch share one concurrency group,
  `deploy-<ref>`; a run that starts while another of `main` runs waits for it, and a running deploy is
  never cancelled. GitHub keeps one waiting run: a newer one replaces it, and deploys the newer
  commit, so everything the replaced one would have. A start by hand on another branch is in another
  group and cannot replace a waiting deploy of `main` (O: two starts by hand in a row; the second
  waits until the first has ended, then runs).
- **AC-76** (L) A third-party action is named by the commit it runs, not by a tag that can move:
  `pnpm/action-setup`, whose pnpm runs `pnpm run deploy` with the token. GitHub's own actions are
  named by their major version. Neither workflow leaves the run's token in `.git/config`, where the
  code of the dependencies that build and test the site could read it.
- **AC-77** (L, O) What IndexNow is owed outlives the runner. Before `pnpm run deploy` the job
  restores `.indexnow-owed.json` from the most recent note an earlier deploy run saved (none on the
  first run). After it, whatever the outcome, the job saves the file, when there is one, as a new
  note: a run whose `pnpm run deploy` passed saves `[]` (nothing owed, as `pnpm indexnow before` reads
  it); any other run saves the file as the deploy left it. A run that restored nothing and stopped
  ahead of `pnpm indexnow before` has no file and saves nothing; the most recent note stays the one
  before it (O: a run that fails at the upload saves a note, and the next run restores that note).
- **AC-78** (L, O) A push of the tag `extension-v<version>`, where `<version>` is the `version` of
  `extension/public/manifest.json`, runs the extension's E2E tests (`--project=extension`; its web
  server builds `dist-extension/`) and creates a GitHub Release named by the tag, with generated notes
  and one file, `avifbox-extension-<version>.zip`. The zip holds the content of `dist-extension/`,
  not the folder: `manifest.json` is at its root (O: the release `extension-v0.1.0`; its zip,
  unpacked, is the same files, byte for byte, as `pnpm build:extension` of the same commit on the
  owner's machine).
- **AC-79** (L, O) A tag `extension-v<version>` whose version is not the manifest's fails before
  anything is installed or built, names both versions, and creates no release (O: `extension-v0.0.0`,
  deleted afterwards).
- **AC-80** (L) The release job may write the repository's contents and uses the run's own token; it
  is given no secret. Tests that fail create no release.

## Decisions worth recording

- **The run on GitHub is `pnpm run deploy`, not a copy of its steps in YAML.** The chain AC-47 reads
  stays in one place, and a deploy from a machine and one from GitHub do the same.
- **No run for pull requests, for now.** Written on the premise that the owner pushes to `main` and
  opens none, where the deploy run is the test run. Three pull requests were opened the same day
  (#1…#3), so whether a pull request gets a run of the tests is an open question.
- **The IndexNow note lives in GitHub's cache.** A runner starts empty, and a run tried again is a new
  runner, so the file alone would lose what a failed deploy owed: the next run would see a site that
  already serves the build. A cache entry cannot be replaced, so each run saves under a key of its own
  (`indexnow-owed-<run>-<attempt>`) and restores the most recent one by the prefix. A run that passed
  saves `[]`, or the next run would get back the last note, which was already sent. Limits accepted:
  GitHub drops an entry nobody used for seven days, so what a failed deploy owed is lost when no
  deploy runs in the week after it; a save the cache refuses is a warning and the run stays green, so
  the next run gets an older note (pages sent twice) or, after a failed upload, none (pages never
  sent); a note on a machine and one on GitHub do not meet. Each costs a notice to a search engine at
  most, which a step to check the save is not worth.
- **Only the commit `main` points at goes live.** GitHub's "Re-run" keeps the run's commit; on a run
  that a later deploy has passed it would put the older site back. A re-run of the newest run, the
  usual one after a flaky test, passes the check. A run that starts after a newer push, a window of
  seconds, fails red and the newer run deploys.
- **A concurrency group per branch.** The group is decided before the job's `if`, so with one group
  a start by hand on another branch would take the waiting place of a deploy of `main` and deploy
  nothing.
- **No `account_id` in `wrangler.jsonc`.** The token sees one Cloudflare account (`wrangler whoami`,
  2026-11-24), and wrangler takes it on a runner without the account cache `node_modules/.cache`
  holds on the owner's machine. A token that sees a second account needs `account_id`.
- **Node 24**, the version on the owner's machine, which the deploys so far ran on. `engines` asks for
  22.23.4 or later.
- **`ubuntu-latest` and `playwright install --with-deps`.** The two WebKit packages `CLAUDE.md` names
  are needed on the owner's Ubuntu 26.04; on a runner `--with-deps` installs what the pinned
  Playwright asks for.
- **The token is given to the deploy step alone,** not to the job, and the one third-party action is
  pinned by commit (AC-76): the pnpm it installs is the program that later holds the token.
- **The tag says `extension-`**: the site has no version and is deployed from `main`; a tag names a
  version of the extension only.
- **`gh release create`, which every runner has**, rather than an action of someone else's holding a
  token that may write the repository.
- **The tag must name the manifest's version.** A release whose zip says another version than its name
  is worse than none.
- **A required reviewer is GitHub's setting, off.** The question was how to deploy by itself. When a
  deploy should wait for the owner's approval: Settings → Environments → `production` → Required
  reviewers. The workflow does not change. The environment lets only `main` deploy, so a workflow on
  another branch cannot be given the token either.

## Approval

Approved by the owner on 2026-11-24 as "做" (do it), on the plan of the same day: two workflows, the
IndexNow note in GitHub's cache, the token in the environment `production`. Whether a deploy waits
for approval was asked and left open; it does not, as the question asked for a deploy by itself.

## Observed

- 2026-11-24, AC-74, not met: commit `a9c2cff` pushed to `main`. GitHub registered both workflows
  (`deploy` and `extension`, both "active") and started no run in five minutes. A start by hand was
  refused: "HTTP 422: Actions has been disabled for this user." The repository allows Actions and all
  actions; the block is on the account `nexuslaiban`, and only GitHub can lift it. No AC is observed
  yet. The environment `production` exists, limited to `main`, with no secret.
