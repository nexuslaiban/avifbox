export type Format = 'avif' | 'webp' | 'jpeg' | 'png';
export type Target = 'png' | 'jpg';
export type Gamut = 'srgb' | 'display-p3';
export type ToneMode = 'brightness' | 'colour';
export type Pixels = Uint8Array | Uint8ClampedArray;

/** Coding-independent code points (ITU-T H.273) as stored in an AVIF `colr`/`nclx` box. */
export interface Cicp {
  primaries: number;
  transfer: number;
  matrix: number;
  fullRange: boolean;
}

/** What can be learned from the file bytes alone, before any pixel is decoded. */
export interface ImageInfo {
  format: Format;
  bitDepth: number;
  animated: boolean;
  cicp: Cicp | null;
  hdr: 'pq' | 'hlg' | null;
}

export interface Frame {
  rgba: Uint8ClampedArray;
  delayMs: number;
}

/** A decoded image: one frame for stills, several for animations. Frames are produced lazily. */
export interface FrameSource {
  width: number;
  height: number;
  frameCount: number;
  /** Animation repeat count; 0 means forever. */
  loops: number;
  /** True when HDR was tone-mapped by this engine rather than rendered by the browser. */
  toneMapped: boolean;
  frames(): AsyncGenerator<Frame>;
}

export interface ConvertOptions {
  target: Target;
  /** PNG: `truecolor` is lossless, `optimized` reduces to a palette of at most 256 colours. */
  pngMode: 'truecolor' | 'optimized';
  /** JPG quality, 1–100. */
  quality: number;
  /** `#rrggbb` to flatten transparency onto, or null to keep it. JPG always flattens (white if null). */
  background: string | null;
  /** Animated input: one file per frame, or a single animated PNG (PNG target only). */
  animation: 'frames' | 'apng';
  tone: ToneMode;
  gamut: Gamut;
  /** JPG target, JPEG input: hand back the original bytes instead of re-encoding. */
  keepJpeg: boolean;
}

export interface Output {
  blob: Blob;
  width: number;
  height: number;
  /** 0-based frame index for per-frame outputs of an animation, otherwise null. */
  frame: number | null;
}

export type ConvertEvent =
  | { type: 'info'; info: ImageInfo; frameCount: number; width: number; height: number; toneMapped: boolean }
  | { type: 'output'; output: Output };

export interface Capabilities {
  /** Canvas can hold Display P3 pixels. */
  p3: boolean;
  /** `ImageDecoder` is available, so animations can be read frame by frame. */
  frames: boolean;
}
