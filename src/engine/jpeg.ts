const SOI = [0xff, 0xd8, 0xff];
const ICC_TAG = [...'ICC_PROFILE\0'].map((c) => c.charCodeAt(0));
const MAX_SEGMENT_PAYLOAD = 65533;

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= SOI.length && SOI.every((b, i) => bytes[i] === b);
}

/** Adds the profile as an APP2 segment, after any JFIF/Exif header where decoders expect it. */
export function embedIcc(jpeg: Uint8Array, icc: Uint8Array): Uint8Array {
  const payload = ICC_TAG.length + 2 + icc.length;
  if (payload > MAX_SEGMENT_PAYLOAD) throw new Error('ICC profile does not fit in one JPEG segment');
  let at = 2;
  while (jpeg[at] === 0xff && (jpeg[at + 1] === 0xe0 || jpeg[at + 1] === 0xe1)) {
    at += 2 + ((jpeg[at + 2] << 8) | jpeg[at + 3]);
  }
  const length = payload + 2;
  const segment = Uint8Array.from([0xff, 0xe2, length >> 8, length & 255, ...ICC_TAG, 1, 1, ...icc]);
  const out = new Uint8Array(jpeg.length + segment.length);
  out.set(jpeg.subarray(0, at));
  out.set(segment, at);
  out.set(jpeg.subarray(at), at + segment.length);
  return out;
}

/** Encodes opaque RGBA with the browser's JPEG encoder. `quality` is 1–100. */
export async function encodeJpeg(rgba: Uint8ClampedArray, width: number, height: number, quality: number, icc?: Uint8Array): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error(`This browser cannot create a ${width}×${height} canvas for JPG output`);
  context.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: quality / 100 });
  if (!icc) return blob;
  const tagged = embedIcc(new Uint8Array(await blob.arrayBuffer()), icc);
  return new Blob([tagged as BlobPart], { type: 'image/jpeg' });
}
