import type { ConvertOptions, FrameSource, ImageInfo } from './types';

export interface Decoders {
  /** The browser's own decoder: every format, animations included. */
  native(bytes: Uint8Array, info: ImageInfo, options: ConvertOptions): Promise<FrameSource>;
  /** WASM decode at full bit depth followed by our tone mapping. Stills only. */
  hdr(bytes: Uint8Array, info: ImageInfo, options: ConvertOptions): Promise<FrameSource>;
  /** WASM decode to 8-bit, for browsers without AVIF support. Stills only. */
  wasm(bytes: Uint8Array): Promise<FrameSource>;
}

/** Chooses the decoder for a file and falls back when the first choice cannot handle it. */
export async function openImage(
  bytes: Uint8Array,
  info: ImageInfo,
  options: ConvertOptions,
  decoders: Decoders,
): Promise<FrameSource> {
  if (info.hdr && !info.animated) {
    try {
      return await decoders.hdr(bytes, info, options);
    } catch {
      // The browser can still render it, with its own tone mapping.
    }
  }
  try {
    return await decoders.native(bytes, info, options);
  } catch (error) {
    if (info.format !== 'avif') throw error;
    return decoders.wasm(bytes).catch(() => {
      throw error;
    });
  }
}
