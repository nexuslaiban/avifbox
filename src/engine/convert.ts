import { ConvertError } from './errors';
import { srgbToDisplayP3 } from './hdr';
import { displayP3Profile } from './icc';
import { encodeAvif } from './avif';
import { encodeJpeg } from './jpeg';
import { openImage, type Decoders } from './open';
import { flatten, parseHex } from './pixels';
import { ApngWriter, encodePng } from './png';
import { probe } from './probe';
import type { ConvertEvent, ConvertOptions } from './types';

/**
 * Converts one file. Yields what was learned about it first, then one output per result file:
 * a single image, one per animation frame, or one animated PNG.
 */
export async function* convert(file: Blob, options: ConvertOptions, decoders: Decoders): AsyncGenerator<ConvertEvent> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = probe(bytes);
  if (!info) throw new ConvertError('Not a supported image. AVIFBox reads AVIF, WebP, JPG/JFIF and PNG.');

  // A JFIF file already is a JPEG: handing back the same bytes is the only lossless "conversion".
  if (options.target === 'jpg' && options.keepJpeg && info.format === 'jpeg') {
    // Proves the file decodes, and gives its size. The type is set from the content, not the file name.
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    const { width, height } = bitmap;
    bitmap.close();
    yield { type: 'info', info, frameCount: 1, width, height, toneMapped: false };
    yield { type: 'output', output: { blob: new Blob([bytes], { type: 'image/jpeg' }), width, height, frame: null } };
    return;
  }

  // The AVIF encoder writes 8-bit sRGB with no profile, so the pixels are read in sRGB for it.
  if (options.target === 'avif') options = { ...options, gamut: 'srgb' };
  const source = await openImage(bytes, info, options, decoders);
  const { width, height, frameCount } = source;
  yield { type: 'info', info, frameCount, width, height, toneMapped: source.toneMapped };

  const icc = source.gamut === 'display-p3' ? displayP3Profile() : undefined;
  const fill = options.target === 'jpg' ? (options.background ?? '#ffffff') : options.background;
  // The picker speaks sRGB; in a Display P3 image the same colour is written with different numbers.
  const picked = fill ? parseHex(fill) : null;
  const background = picked && source.gamut === 'display-p3' ? srgbToDisplayP3(picked) : picked;
  const apng =
    options.target === 'png' && options.animation === 'apng' && frameCount > 1
      ? new ApngWriter(width, height, { loops: source.loops, icc })
      : null;

  let index = 0;
  for await (const frame of source.frames()) {
    if (background) flatten(frame.rgba, background);
    if (apng) {
      await apng.add(frame.rgba, frame.delayMs);
    } else {
      const blob =
        options.target === 'png'
          ? await encodePng(frame.rgba, width, height, { mode: options.pngMode, icc })
          : options.target === 'avif'
            ? await encodeAvif(frame.rgba, width, height, options.quality)
            : await encodeJpeg(frame.rgba, width, height, options.quality, icc);
      yield { type: 'output', output: { blob, width, height, frame: frameCount > 1 ? index : null } };
    }
    index++;
  }
  if (apng) yield { type: 'output', output: { blob: apng.finish(), width, height, frame: null } };
}
