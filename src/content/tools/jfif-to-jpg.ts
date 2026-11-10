import { LIMITS, LIMITS_AND_PRIVACY, PRIVACY_FAQ, RELATED } from '../site';
import type { ToolPage } from '../types';

export const jfifToJpg: ToolPage = {
  slug: 'jfif-to-jpg',
  from: '.JFIF',
  to: '.JPG',
  sourceLabel: 'JFIF',
  accept: '.jfif,.jfi,.jif,.jpe,image/jpeg',
  target: 'jpg',
  sibling: { label: 'PNG', href: '/jfif-to-png' },
  offerKeepJpeg: true,
  title: 'JFIF to JPG Converter — Lossless, Free, No Upload | AVIFBox',
  description:
    'Convert JFIF to JPG without losing quality: the image data stays byte-for-byte identical. Batch 50 files in your browser. Free, no upload, no sign-up.',
  h1: 'JFIF to <em>JPG</em> Converter',
  lede: 'A .jfif file is already a JPEG under an unusual name. This converter hands it back as a .jpg with the image data untouched — on your device, with nothing uploaded.',
  howToTitle: 'How to convert JFIF to JPG',
  steps: [
    {
      title: 'Add your JFIF files',
      body: `Drop them on the box, press <strong>Choose files</strong>, or paste with Ctrl+V — up to ${LIMITS}.`,
    },
    {
      title: 'Leave “Keep original” on',
      body: 'The picture is not compressed again: you get the same bytes under a .jpg name. Choose Re-encode only if you want a smaller file.',
    },
    {
      title: 'Download',
      body: 'Save each JPG, or the batch as one ZIP. Need PNG instead? Use <a href="/jfif-to-png">JFIF to PNG</a>.',
    },
  ],
  comparison: {
    caption: 'JFIF and JPG side by side',
    columns: ['JFIF', 'JPG'],
    rows: [
      [
        'What it is',
        'JPEG File Interchange Format: the standard layout of a JPEG file',
        'The usual name and extension for JPEG images',
      ],
      ['Extension', '.jfif, sometimes .jfi or .jif', '.jpg or .jpeg'],
      ['Image data', 'JPEG compression', 'JPEG compression — identical'],
      ['MIME type', 'image/jpeg', 'image/jpeg'],
      ['Quality', 'Whatever the JPEG was saved at', 'The same'],
      ['Opens in', 'Browsers and most viewers; some apps and upload forms refuse the extension', 'Everything'],
      ['Usually comes from', '“Save image as” on Windows', 'Cameras, phones, every editor'],
    ],
  },
  sections: [
    {
      id: 'what',
      title: 'What a JFIF file is',
      body: [
        'JFIF stands for JPEG File Interchange Format, the 1992 specification for how JPEG-compressed data is laid out in a file. Nearly every .jpg you have opened is a JFIF file on the inside, or its cousin Exif, which cameras use. The .jfif extension just says so out loud: the picture, its quality and its compression are plain JPEG.',
      ],
    },
    {
      id: 'why',
      title: 'Why Windows saves .jfif',
      body: [
        'On some Windows 10 and 11 PCs, the system setting that maps the type <code>image/jpeg</code> to a file extension points at .jfif. Chrome, Edge and other browsers ask Windows which extension to use, so “Save image as” produces .jfif files even though the website served an ordinary JPEG. Programs and upload forms that check the extension then turn the file away.',
      ],
    },
    {
      id: 'lossless',
      title: 'Lossless by default',
      body: [
        'Because the data already is JPEG, the right conversion is no conversion. With <strong>Keep original</strong> selected, the converter checks that the file really decodes as a JPEG and returns it unchanged under a .jpg name: same pixels, same metadata, same size, identical byte for byte.',
        '<strong>Re-encode</strong> is for when you want a smaller file and accept another round of JPEG compression. The quality slider sets how much, and the new size is shown at once.',
      ],
    },
    {
      id: 'rename',
      title: 'Doing it without a converter',
      body: [
        'For a file or two you can simply rename it: turn on file name extensions in File Explorer’s View menu, change .jfif to .jpg and confirm the warning. The converter earns its keep with dozens of files, on a phone where extensions are hard to edit, or when a file is not what its name claims.',
        'To stop Windows producing .jfif files, open the Registry Editor, go to <code>HKEY_CLASSES_ROOT\\MIME\\Database\\Content Type\\image/jpeg</code> and change the value <code>Extension</code> from <code>.jfif</code> to <code>.jpg</code>. Back up the registry first, and leave it alone if you are not comfortable editing it — converting works either way.',
      ],
    },
    LIMITS_AND_PRIVACY,
  ],
  faq: [
    {
      question: 'How do I convert JFIF to JPG?',
      answer:
        'Drop your .jfif files on the box at the top of this page or press Choose files, then download the .jpg files — one by one or as a ZIP.',
    },
    {
      question: 'Is JFIF the same as JPG?',
      answer:
        'In every way that matters, yes: both hold JPEG image data. JFIF is the name of the file layout; .jpg is the extension people and programs expect.',
    },
    {
      question: 'Does converting JFIF to JPG reduce quality?',
      answer:
        'Not here. With Keep original the output is byte-for-byte identical to the input. Quality only changes if you choose Re-encode.',
    },
    {
      question: 'Can I just rename .jfif to .jpg?',
      answer:
        'Yes. Renaming works because the contents are already JPEG. A converter is quicker for batches and on phones, where changing an extension is awkward.',
    },
    {
      question: 'Why do my downloads save as JFIF?',
      answer:
        'A Windows setting maps JPEG images to the .jfif extension, and browsers follow it. The website is not doing anything unusual.',
    },
    {
      question: 'How do I convert many JFIF files at once?',
      answer: `Add up to ${LIMITS} and download the results as a single ZIP. There is no limit on the number of batches.`,
    },
    {
      question: 'Are JFIF files safe to open?',
      answer: 'A JFIF file is an ordinary image, no riskier than any other JPEG. Only the extension is unusual.',
    },
    PRIVACY_FAQ,
  ],
  input: 'JFIF and any other JPEG file',
  output: 'JPG — the original data, or re-encoded at quality 1–100',
  metadata: 'Kept exactly with Keep original; not copied when re-encoding',
  related: [RELATED.jfifToPng, RELATED.avifToJpg, RELATED.webpToPng, RELATED.avifToPng],
};
