import { useEffect, useRef, useState } from 'preact/hooks';
import { probe } from '../engine/probe';
import type { ImageInfo } from '../engine/types';
import { formatBytes } from './format';
import './converter.css';
import './viewer.css';

interface Opened {
  name: string;
  size: number;
  url: string;
  info: ImageInfo | null;
}

const PRIMARIES: Record<number, string> = {
  1: 'BT.709 (sRGB colours)',
  9: 'BT.2020 (wide gamut)',
  11: 'DCI-P3 (wide gamut)',
  12: 'Display P3 (wide gamut)',
};

const FORMATS: Record<ImageInfo['format'], string> = { avif: 'AVIF', webp: 'WebP', jpeg: 'JPEG', png: 'PNG' };

function colour(info: ImageInfo): string {
  if (info.hdr) return `HDR (${info.hdr.toUpperCase()}), ${PRIMARIES[info.cicp?.primaries ?? 0] ?? 'BT.2020'}`;
  return PRIMARIES[info.cicp?.primaries ?? 0] ?? 'Not specified (treated as sRGB)';
}

/** Shows an AVIF the browser can decode, plus what its container says about it. Nothing is uploaded. */
export default function Viewer() {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => () => (opened ? URL.revokeObjectURL(opened.url) : undefined), [opened]);

  const open = async (file: File | undefined) => {
    if (!file) return;
    setSize(null);
    setFailed(false);
    const info = probe(new Uint8Array(await file.arrayBuffer()));
    setOpened({ name: file.name, size: file.size, url: URL.createObjectURL(file), info });
  };

  const facts: [string, string][] = [];
  if (opened) {
    facts.push(['File', opened.name], ['Size', formatBytes(opened.size)]);
    if (opened.info) facts.push(['Format', FORMATS[opened.info.format]]);
    if (size) facts.push(['Dimensions', `${size.width} × ${size.height} pixels`]);
    if (opened.info) {
      facts.push(['Bit depth', `${opened.info.bitDepth}-bit`], ['Colour', colour(opened.info)], ['Animated', opened.info.animated ? 'Yes' : 'No']);
    }
  }

  return (
    <div class="vw">
      <div
        class="cv-drop"
        data-testid="viewer-drop"
        data-dragging={dragging ? '' : undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void open(event.dataTransfer?.files[0]);
        }}
      >
        <p class="cv-drop-title">Drop an AVIF to look at it</p>
        <p class="cv-drop-actions">
          <button type="button" class="btn btn-primary" onClick={() => picker.current?.click()}>
            Choose a file
          </button>
        </p>
        <input
          ref={picker}
          type="file"
          hidden
          accept=".avif,image/avif"
          onChange={(event) => {
            void open(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        <ul class="cv-facts">
          <li>Opened by your browser</li>
          <li>Never uploaded</li>
        </ul>
      </div>

      {opened && (
        <div class="vw-result" aria-live="polite">
          <figure class="vw-stage">
            {failed || !opened.info ? (
              <p class="vw-failed">
                {opened.info
                  ? 'This browser cannot display the file. The converter can still decode it — use the buttons below.'
                  : 'This does not look like an AVIF, WebP, JPG or PNG image.'}
              </p>
            ) : (
              <img
                src={opened.url}
                alt={`Preview of ${opened.name}`}
                onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                onError={() => setFailed(true)}
              />
            )}
          </figure>
          <div class="vw-facts">
            <dl>
              {facts.map(([label, value]) => (
                <>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </>
              ))}
            </dl>
            <p class="vw-next">
              <a class="btn btn-primary" href="/avif-to-png">
                Convert to PNG
              </a>
              <a class="btn" href="/avif-to-jpg">
                Convert to JPG
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
