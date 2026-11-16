// Tells IndexNow which pages a deploy changed: two steps of `pnpm run deploy`, around the upload.
//   pnpm indexnow before   notes the pages the live site does not serve as built
//   pnpm indexnow after    sends that note, once the upload is live and checked
// Exits with 1 when a step could not do its part.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ask, readBuild } from './deployed.ts';
import { news, owed, pagesOf, tell } from './indexnow.ts';

/** The pages IndexNow is still owed. Only a notice it accepted removes the note. Ignored by git. */
const NOTE = fileURLToPath(new URL('../.indexnow-owed.json', import.meta.url));

const noted = (): string[] => JSON.parse(readFileSync(NOTE, 'utf8'));

async function before(): Promise<string> {
  const build = readBuild();
  // A note that is still there was never sent. The site may serve those pages by now, so asking it would not find them.
  const pages = owed(build, existsSync(NOTE) ? noted() : [], await news(build, ask));
  writeFileSync(NOTE, JSON.stringify(pages));
  return [`${pages.length} of ${pagesOf(build).length} pages to tell IndexNow of after the upload`, ...pages].join(
    '\n  ',
  );
}

async function after(): Promise<string> {
  let pages: string[];
  try {
    pages = noted();
  } catch {
    // A missing note is not an empty one: nothing says that no page changed.
    throw new Error('no pages were noted before the upload: `pnpm indexnow before` has to run first');
  }
  const answer = await tell(readBuild(), pages, fetch).catch((error: Error) => {
    throw new Error(`${error.message}. The upload is not affected; \`pnpm indexnow after\` tries again`);
  });
  rmSync(NOTE);
  return answer;
}

const step = { before, after }[process.argv[2] ?? ''];
try {
  if (!step) throw new Error('usage: pnpm indexnow before | after');
  console.log(await step());
} catch (error) {
  console.error(`FAILED: ${(error as Error).message}`);
  process.exitCode = 1;
}
