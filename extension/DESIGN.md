# Design of the browser extension

The record of decisions, with what was measured and what was only read, is in the specification:
[`docs/specs/2026-11-21-extension-save-image-as.md`](../docs/specs/2026-11-21-extension-save-image-as.md),
"Decisions worth recording". This page is the map.

## Goal

One click on an image saves it as PNG or JPG, converted on the device by the site's engine as it is.
A failure is said in a window, never silent.

Not goals: settings, several images at once, animated output, Firefox, publishing. The specification
lists them under "Out of scope".

## Parts and messages

```
 page ──right-click──▶ Chrome's menu
                            │ contextMenus.onClicked { menuItemId, srcUrl }
                            ▼
   ┌──────────────────────────────────────────┐        Job { srcUrl, target }        ┌─────────────────────────────────┐
   │ service worker                           │ ───────────────────────────────────▶ │ hidden document                 │
   │ background.ts → menus.ts                 │                                      │ offscreen.ts → save.ts          │
   │                                          │ ◀─────────────────────────────────── │                                 │
   │ opens the hidden document when none is   │   Result { url, names } | { failure }│ fetch(srcUrl, with cookies)     │
   │ result → downloads.download(url, name)   │                                      │ engine Pool → worker (+ WASM)   │
   │       or windows.create(notice.html#why) │                                      │ URL.createObjectURL(first file) │
   └──────────────────────────────────────────┘                                      └─────────────────────────────────┘
```

- A service worker has no `Worker`, no `ImageDecoder` and no `URL.createObjectURL`, so the engine runs
  in a hidden ("offscreen") document. Only `chrome.runtime` exists there, so the menu, the download and
  the failure window stay with the service worker.
- `menus.ts` and `save.ts` hold all the logic and touch no global of the browser: Chrome, `fetch`, the
  engine's pool and the document's functions are handed in. The two entry scripts are the wiring.

## What is kept, and for how long

| State                              | Where                 | Until                                          |
| ---------------------------------- | --------------------- | ---------------------------------------------- |
| the opening of the hidden document | service worker memory | it has opened or failed                        |
| jobs that are running, their count | hidden document       | each job's result is reported                  |
| the address of a converted file    | hidden document       | 60 seconds after it was handed over            |
| the hidden document itself         | Chrome                | it closes itself 60 seconds after its last job |

Chrome stops an idle service worker after 30 seconds. So the click handler does not wait for the
result: the hidden document reports with a message of its own, which starts the service worker again,
and the result handler works from that message alone.

The hidden document answers a job at once with whether it took it. One that has asked to be closed is
there for a moment more and takes none; the click then opens the failure window ("Please try again"),
as one that could not be delivered does. A job is therefore never lost without a word.

## Decisions and trade-offs

| Decision                                   | Instead of                    | Because                                                                     |
| ------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------- |
| access to every site, asked for at install | a prompt at first use         | the same warning either way; a prompt cannot be tested by machine           |
| the request carries the site's cookies     | `credentials: 'omit'`         | some images are only there for a signed-in visitor                          |
| `chrome.downloads`                         | a hidden link with `download` | it is the documented way and follows "Ask where to save each file"          |
| two names per file, the browser picks      | a list of forbidden names     | Chrome refuses more names than a list could keep up with                    |
| a window for a failure                     | a notification                | no extra permission, and it cannot be silenced by the operating system      |
| an interface of our own for Chrome's API   | `@types/chrome`               | that would make `chrome` a global of the whole project, the engine included |

Known limits: images a page made itself (`blob:` addresses) cannot be fetched; a site that checks the
`Referer` refuses the request; pictures that are not image elements have no menu item.

## Security

Nothing a page controls is trusted.

- **The address** is the page's. It is only ever fetched: one `GET`, which the user asked for with
  three deliberate clicks and whose answer the page never sees. It carries the cookies of the image's
  site, `SameSite` ones included: an accepted risk, recorded in the specification.
- **The bytes** go to the decoders only, inside a worker, and at most 50 MB of them are read.
- **The name** is cleaned and cut, and its extension is ours. Chrome fits the extension to the
  content type besides, so a name cannot disguise a file.
- **The failure text** is the engine's or one of the extension's own sentences, and the window writes
  it as text.
- **No way in**: no content script, no web-accessible resource, no `externally_connectable`. The
  pages run under `script-src 'self' 'wasm-unsafe-eval'`, with no inline script.
