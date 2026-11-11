import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { outputName } from '../engine/names';
import { Pool, type JobRunner } from '../engine/pool';
import { probe } from '../engine/probe';
import type { ImageInfo } from '../engine/types';
import { formatBytes } from './format';
import { saveAs } from './save';
import { ConverterStore, defaultOptions, useStore, type Item } from './store';
import './converter.css';
import './viewer.css';

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

/** Shows one image at a time: the picture, what its container says, its frames. Nothing is uploaded. */
export default function Viewer() {
  const pool = useMemo(() => new Pool(), []);
  // The converter's own store, one file long. Its PNG job decodes the file once: the outputs are the
  // frame thumbnails and what "Save as PNG" hands over.
  const store = useMemo(() => new ConverterStore(pool, defaultOptions('png')), []);
  const { items, notice } = useStore(store);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const open = (file: File | undefined) => {
    if (!file) return;
    store.clear();
    store.add([file]);
  };

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
          open(event.dataTransfer?.files[0]);
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
            open(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        <ul class="cv-facts">
          <li>Opened by your browser</li>
          <li>Never uploaded</li>
        </ul>
      </div>

      {/* Always present, so screen readers announce the result when it appears. */}
      <div aria-live="polite">
        {notice && <p class="cv-notice">{notice}</p>}
        {/* Keyed by file: everything known about the last one goes when the next one is opened. */}
        {items.map((item) => (
          <Opened key={item.id} item={item} runner={pool} />
        ))}
      </div>
    </div>
  );
}

/** The open file: on the stage, described, and ready to save. Lives exactly as long as the file is open. */
function Opened({ item, runner }: { item: Item; runner: JobRunner }) {
  const { file, detail, outputs } = item;
  /** What the container says: undefined until it has been read, null if this is not an image. */
  const [info, setInfo] = useState<ImageInfo | null>();
  /** Natural size of the picture on the stage. */
  const [size, setSize] = useState<{ width: number; height: number }>();
  /** The browser could not draw the file itself. */
  const [undrawable, setUndrawable] = useState(false);
  /** The frame on the stage, or null while the file is shown as it is. */
  const [chosen, setChosen] = useState<number | null>(null);
  /** A "Save as JPG" job is running, and why the last one failed. */
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const jpgJob = useRef<number | null>(null);

  // The file as it is, for the browser to draw: it plays an animation and renders HDR its own way.
  const original = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(original), [original]);

  useEffect(() => {
    // Read here as well as by the converter, which only reports after decoding: the facts should not wait for that.
    void file.arrayBuffer().then(
      (buffer) => setInfo(probe(new Uint8Array(buffer))),
      () => setInfo(null),
    );
    return () => {
      if (jpgJob.current !== null) runner.cancel(jpgJob.current);
    };
  }, []);

  const frameCount = detail?.frameCount ?? 1;
  const failure = item.status === 'error' ? item.error : null;
  // What the buttons save: the chosen frame, else the first one — which for a still is the picture.
  const target = outputs.at(chosen ?? 0);
  // Shown as it is until a frame is chosen. If the browser cannot draw the file, the decoded picture stands in.
  const src = chosen !== null ? outputs.at(chosen)?.url : undrawable ? outputs.at(0)?.url : original;
  const alt = chosen !== null ? `Frame ${chosen + 1} of ${file.name}` : `Preview of ${file.name}`;

  const saveJpg = () => {
    if (!target) return;
    const { frame } = target;
    const name = outputName(item.base, 'jpg', frame === null ? undefined : { frame, of: frameCount });
    const finish = (error: string | null) => {
      jpgJob.current = null;
      setSaving(false);
      setProblem(error);
    };
    setSaving(true);
    setProblem(null);
    const job = runner.submit(file, defaultOptions('jpg'), {
      onEvent(event) {
        if (event.type !== 'output' || event.output.frame !== frame) return;
        saveAs(event.output.blob, name);
        // Nothing after this is wanted: in an animation, that is every later frame.
        runner.cancel(job);
        finish(null);
      },
      onDone: () => finish(null),
      onError: finish,
    });
    jpgJob.current = job;
  };

  const facts: [string, string][] = [
    ['File', file.name],
    ['Size', formatBytes(file.size)],
  ];
  if (info) facts.push(['Format', FORMATS[info.format]]);
  if (size) facts.push(['Dimensions', `${size.width} × ${size.height} pixels`]);
  if (info)
    facts.push(
      ['Bit depth', `${info.bitDepth}-bit`],
      ['Colour', colour(info)],
      ['Animated', info.animated ? 'Yes' : 'No'],
    );
  if (frameCount > 1) facts.push(['Frames', String(frameCount)]);

  return (
    <div class="vw-result">
      <figure class="vw-stage">
        {/* A failed decode wins over the picture: Chrome "loads" a truncated AVIF without an error and draws nothing. */}
        {src && !failure ? (
          <img
            src={src}
            alt={alt}
            onLoad={(event) =>
              setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
            }
            onError={() => setUndrawable(true)}
          />
        ) : (
          <p class="vw-status">{failure ?? 'Decoding…'}</p>
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
        {!failure && (
          <>
            <p class="vw-save">
              <button
                type="button"
                class="btn btn-primary"
                disabled={!target}
                onClick={() => target && saveAs(target.blob, target.name)}
              >
                Save as PNG
              </button>
              <button type="button" class="btn" disabled={!target || saving} onClick={saveJpg}>
                Save as JPG
              </button>
            </p>
            {problem && <p class="cv-error">{problem}</p>}
            {frameCount > 1 && (
              <p class="cv-note">
                Saves frame {(chosen ?? 0) + 1} of {frameCount}. Choose another one below.
              </p>
            )}
            {info?.animated && detail && frameCount === 1 && (
              <p class="cv-note">
                Only the first frame is available: this browser does not let a page step through an animation. Chrome,
                Edge and Firefox do.
              </p>
            )}
            {detail?.toneMapped && (
              <p class="cv-note">HDR is tone-mapped to standard dynamic range in the saved copy.</p>
            )}
            <p class="cv-note">
              Batches, every frame, quality and background: <a href="/avif-to-png">AVIF to PNG</a>,{' '}
              <a href="/avif-to-jpg">AVIF to JPG</a>.
            </p>
          </>
        )}
      </div>
      {frameCount > 1 && (
        // aria-live off: thumbnails arrive one by one, and reading each out would drown the rest.
        <div class="vw-frames" aria-live="off">
          <p class="vw-frames-head">
            <span>{frameCount} frames</span>
            <button type="button" class="btn btn-quiet" aria-pressed={chosen === null} onClick={() => setChosen(null)}>
              Play
            </button>
          </p>
          <ul aria-label={`Frames of ${file.name}`}>
            {outputs.map((output, index) => (
              <li>
                <button type="button" aria-pressed={chosen === index} onClick={() => setChosen(index)}>
                  <img src={output.url} alt="" loading="lazy" decoding="async" />
                  <span>
                    <span class="sr-only">Frame </span>
                    {index + 1}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
