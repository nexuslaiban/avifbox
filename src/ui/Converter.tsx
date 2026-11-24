import type { ComponentChildren, RefObject } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { detectCapabilities, isSupportedBrowser } from '../engine/capabilities';
import { MAX_FILES, MAX_FILE_BYTES } from '../engine/limits';
import { uniqueNames } from '../engine/names';
import { Pool } from '../engine/pool';
import type { Capabilities, ConvertOptions, Target } from '../engine/types';
import { formatBytes, sizeChange } from './format';
import { Report } from './Report';
import { saveAs } from './save';
import { ConverterStore, defaultOptions, selectedOutputs, totals, useStore, type Item, type State } from './store';
import './converter.css';

export interface Sample {
  label: string;
  url: string;
}

export interface ConverterProps {
  /** What the page converts from, as it should read in the drop zone: "AVIF", "JFIF", "WebP", "image". */
  sourceLabel: string;
  /** `accept` attribute for the file picker. Dropped and pasted files are not filtered by it. */
  accept: string;
  target: Target;
  /** How animated input is exported to start with. Default: one file per frame. */
  animation?: ConvertOptions['animation'];
  /** Let the visitor switch between PNG and JPG output (home page). */
  chooseTarget?: boolean;
  /** Always show the keep-original / re-encode choice (JFIF to JPG). */
  offerKeepJpeg?: boolean;
  samples?: Sample[];
}

const WIDE_PRIMARIES = new Set([9, 11, 12]); // BT.2020, DCI-P3, Display P3
const MAX_MB = MAX_FILE_BYTES / (1024 * 1024);
const ZIP_NAME = 'avifbox-images.zip';

export default function Converter(props: ConverterProps) {
  const store = useMemo(() => new ConverterStore(new Pool(), defaultOptions(props.target, props.animation)), []);
  const state = useStore(store);
  const { items, notice } = state;
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [supported, setSupported] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [zipping, setZipping] = useState(false);
  // Something the visitor asked for that could not be done; shown where notices go.
  const [problem, setProblem] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const chooser = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSupported(isSupportedBrowser());
    setCapabilities(detectCapabilities());
  }, []);

  // The whole page is a drop target, and Ctrl+V works wherever the focus is.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      const files = [...(event.dataTransfer?.files ?? [])];
      if (files.length === 0) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      store.add(files);
    };
    const onPaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length === 0) return;
      event.preventDefault();
      store.add(files);
    };
    document.addEventListener('dragenter', onEnter);
    document.addEventListener('dragleave', onLeave);
    document.addEventListener('dragover', onOver);
    document.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('dragenter', onEnter);
      document.removeEventListener('dragleave', onLeave);
      document.removeEventListener('dragover', onOver);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('paste', onPaste);
    };
  }, [store]);

  const addSample = async (sample: Sample) => {
    setProblem(null);
    try {
      const response = await fetch(sample.url);
      if (!response.ok) throw new Error(String(response.status));
      const name = sample.url.split('/').pop() ?? 'sample.avif';
      store.add([new File([await response.blob()], name, { type: response.headers.get('content-type') ?? '' })]);
    } catch {
      setProblem('The sample could not be loaded. Check your connection and try again.');
    }
  };

  const downloadAll = async () => {
    setZipping(true);
    setProblem(null);
    try {
      const { downloadZip } = await import('client-zip');
      const outputs = selectedOutputs(store.getState());
      // A frame of one file can share its name with another file; inside an archive they must differ.
      const names = uniqueNames(outputs.map((output) => output.name));
      const files = outputs.map((output, i) => ({ name: names[i], input: output.blob, lastModified: new Date() }));
      saveAs(await downloadZip(files).blob(), ZIP_NAME);
    } catch {
      setProblem('The ZIP could not be built. Check your connection and try again, or download the files one by one.');
    } finally {
      setZipping(false);
    }
  };

  const clearAll = () => {
    store.clear();
    chooser.current?.focus(); // the button that was pressed is gone; do not drop keyboard users at the top of the page
  };

  const sum = totals(state);
  const pending = sum.files - sum.done - sum.failed;

  return (
    <div class="cv">
      <div class="cv-drop" data-testid="dropzone" data-dragging={dragging ? '' : undefined}>
        <p class="cv-drop-title">Drop {props.sourceLabel} files here</p>
        {supported ? (
          <p class="cv-drop-actions">
            <button ref={chooser} type="button" class="btn btn-primary" onClick={() => picker.current?.click()}>
              Choose files
            </button>
            <span>
              or paste with <kbd>Ctrl</kbd>+<kbd>V</kbd>
            </span>
          </p>
        ) : (
          <p class="cv-unsupported" role="alert">
            This browser is missing features the converter needs. Please update it, or use a current Chrome, Edge,
            Firefox or Safari.
          </p>
        )}
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          accept={props.accept}
          onChange={(event) => {
            store.add([...(event.currentTarget.files ?? [])]);
            event.currentTarget.value = '';
          }}
        />
        <ul class="cv-facts">
          <li>Up to {MAX_FILES} files per batch</li>
          <li>{MAX_MB} MB per file</li>
          <li>Animated AVIF supported — pick frames</li>
          <li>Converted on your device, never uploaded</li>
        </ul>
        {props.samples && props.samples.length > 0 && (
          <p class="cv-samples">
            <span>No file at hand? Try a sample:</span>
            {props.samples.map((sample) => (
              <button type="button" class="btn btn-quiet" onClick={() => addSample(sample)}>
                {sample.label}
              </button>
            ))}
          </p>
        )}
      </div>

      <Settings props={props} state={state} capabilities={capabilities} onChange={(patch) => store.setOptions(patch)} />

      {capabilities && !capabilities.exact && (
        <p class="cv-warning" role="note">
          This browser adds slight random noise to image data that pages read — a privacy feature against
          fingerprinting. Converted images can differ from the source by a level or two in places. Switch that
          protection off for this site if you need exact output.
        </p>
      )}

      <p class="cv-notice" role="status">
        {problem ?? notice}
      </p>

      {/* Always present, so screen readers announce progress from the first file on. */}
      <p class="sr-only" aria-live="polite">
        {items.length === 0
          ? ''
          : pending > 0
            ? `Converting, ${sum.done + sum.failed} of ${sum.files} done`
            : `${sum.done} ready${sum.failed > 0 ? `, ${sum.failed} failed` : ''}`}
      </p>

      {items.length > 0 && (
        <section class="cv-results" aria-label="Results">
          <header class="cv-summary">
            <p>
              {pending > 0 ? (
                <>
                  Converting… <strong>{sum.done + sum.failed}</strong> of <strong>{sum.files}</strong>
                </>
              ) : (
                <>
                  <strong>{sum.done}</strong> {sum.done === 1 ? 'file' : 'files'} ready
                  {sum.failed > 0 && <>, {sum.failed} failed</>}
                </>
              )}
              {sum.outputs > 0 && (
                <span class="cv-summary-size">
                  {formatBytes(sum.inputBytes)} → {formatBytes(sum.outputBytes)} ·{' '}
                  {sizeChange(sum.inputBytes, sum.outputBytes)}
                </span>
              )}
            </p>
            <div class="cv-summary-actions">
              {sum.outputs > 1 && (
                <button type="button" class="btn btn-primary" disabled={pending > 0 || zipping} onClick={downloadAll}>
                  {zipping ? 'Packing…' : `Download all (${sum.outputs}) as ZIP`}
                </button>
              )}
              <button type="button" class="btn" onClick={clearAll}>
                Clear all
              </button>
            </div>
          </header>
          <ul class="cv-list" aria-label="Files">
            {items.map((item) => (
              <Row
                key={item.id}
                item={item}
                canStepFrames={capabilities?.frames ?? true}
                store={store}
                fallbackFocus={chooser}
              />
            ))}
          </ul>
          {sum.failed > 0 && <Report errors={items.flatMap((item) => item.error ?? [])} />}
        </section>
      )}
    </div>
  );
}

// ---------- settings ----------

interface Option<T> {
  value: T;
  label: string;
  hint?: string;
}

function Choice<T extends string>(props: {
  legend: string;
  value: T;
  options: Option<T>[];
  onChange(value: T): void;
  disabled?: boolean;
  note?: ComponentChildren;
}) {
  const name = useId();
  return (
    <fieldset class="cv-choice" disabled={props.disabled}>
      <legend>{props.legend}</legend>
      <div class="cv-choice-options">
        {props.options.map((option) => (
          <div class="cv-option">
            <label>
              <input
                type="radio"
                name={name}
                checked={props.value === option.value}
                aria-describedby={option.hint ? `${name}-${option.value}` : undefined}
                onChange={() => props.onChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
            {option.hint && <small id={`${name}-${option.value}`}>{option.hint}</small>}
          </div>
        ))}
      </div>
      {props.note && <p class="cv-note">{props.note}</p>}
    </fieldset>
  );
}

function Settings(props: {
  props: ConverterProps;
  state: State;
  capabilities: Capabilities | null;
  onChange(patch: Partial<ConvertOptions>): void;
}) {
  const { state, capabilities, onChange } = props;
  const { options, items } = state;
  const id = useId();
  const [quality, setQuality] = useState(options.quality);
  const [advanced, setAdvanced] = useState(false);

  const details = items.flatMap((item) => (item.detail ? [item.detail] : []));
  const hasAnimation = details.some((d) => d.info.animated);
  const hasHdr = details.some((d) => d.info.hdr !== null);
  const hasWideGamut = details.some((d) => d.info.hdr !== null || WIDE_PRIMARIES.has(d.info.cicp?.primaries ?? 0));
  const hasJpegInput = details.some((d) => d.info.format === 'jpeg');
  // Flagged, not opened: expanding it would push the results away from under the pointer.
  const relevant = hasAnimation || hasHdr || hasWideGamut;

  const isPng = options.target === 'png';
  const isAvif = options.target === 'avif';
  const keepChoice = options.target === 'jpg' && (props.props.offerKeepJpeg || hasJpegInput);
  const fill = options.background ?? '#ffffff';

  const transparency = (
    <fieldset class="cv-choice">
      <legend>Transparency</legend>
      <div class="cv-inline">
        <label>
          <input
            type="checkbox"
            checked={options.background !== null}
            onChange={(event) => onChange({ background: event.currentTarget.checked ? fill : null })}
          />
          <span>Fill transparent areas</span>
        </label>
        <label class="cv-colour">
          <span class="sr-only">Background colour</span>
          <input
            type="color"
            value={fill}
            disabled={options.background === null}
            onChange={(event) => onChange({ background: event.currentTarget.value })}
          />
        </label>
      </div>
      <small>Off keeps the alpha channel as it is.</small>
    </fieldset>
  );

  const qualitySlider = (
    <div class="cv-inline">
      <label for={`${id}-quality`}>Quality</label>
      <input
        id={`${id}-quality`}
        type="range"
        min="1"
        max="100"
        value={quality}
        onInput={(event) => setQuality(Number(event.currentTarget.value))}
        onChange={(event) => onChange({ quality: Number(event.currentTarget.value) })}
      />
      <output for={`${id}-quality`}>{quality}</output>
    </div>
  );

  return (
    <form class="cv-settings" aria-label="Output settings" onSubmit={(event) => event.preventDefault()}>
      <div class="cv-core">
        {props.props.chooseTarget && (
          <Choice
            legend="Convert to"
            value={options.target}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'jpg', label: 'JPG' },
            ]}
            onChange={(target) => onChange({ target })}
          />
        )}

        {isPng ? (
          <>
            <Choice
              legend="PNG type"
              value={options.pngMode}
              options={[
                { value: 'truecolor', label: 'Truecolor', hint: 'Lossless. Every pixel exactly as decoded.' },
                { value: 'optimized', label: 'Optimized', hint: 'At most 256 colours. Roughly halves a photo.' },
              ]}
              onChange={(pngMode) => onChange({ pngMode })}
            />
            {transparency}
          </>
        ) : isAvif ? (
          <>
            <fieldset class="cv-choice">
              <legend>AVIF output</legend>
              {qualitySlider}
              <small>
                AVIF’s scale is not JPG’s: 60 suits most photos. The first file loads the encoder (3.5 MB) once.
              </small>
            </fieldset>
            {transparency}
          </>
        ) : (
          <>
            {keepChoice && (
              <Choice
                legend="JPG and JFIF input"
                value={options.keepJpeg ? 'keep' : 'reencode'}
                options={[
                  { value: 'keep', label: 'Keep original', hint: 'Lossless: the same image data, saved as .jpg.' },
                  { value: 'reencode', label: 'Re-encode', hint: 'Compress again with the slider below.' },
                ]}
                onChange={(value) => onChange({ keepJpeg: value === 'keep' })}
              />
            )}
            <fieldset class="cv-choice">
              <legend>JPG output</legend>
              {qualitySlider}
              <div class="cv-inline">
                <label class="cv-colour">
                  <span>Background colour</span>
                  <input
                    type="color"
                    value={fill}
                    onChange={(event) => onChange({ background: event.currentTarget.value })}
                  />
                </label>
              </div>
              <small>JPG has no transparency; see-through areas take this colour.</small>
            </fieldset>
          </>
        )}
      </div>

      <details class="cv-advanced" open={advanced} onToggle={(event) => setAdvanced(event.currentTarget.open)}>
        <summary>
          Animation, HDR and colour profile
          {relevant && <span class="cv-flag">used by your files</span>}
        </summary>
        <div class="cv-advanced-body">
          {isPng ? (
            <Choice
              legend="Animated images"
              value={options.animation}
              options={[
                { value: 'frames', label: 'Every frame', hint: 'One PNG per frame. Untick the ones you do not want.' },
                { value: 'apng', label: 'Animated PNG', hint: 'One .png that still moves (APNG). Always truecolor.' },
              ]}
              onChange={(animation) => onChange({ animation })}
              note={
                capabilities && !capabilities.frames
                  ? 'This browser cannot step through animation frames, so only the first frame is converted.'
                  : undefined
              }
            />
          ) : (
            <fieldset class="cv-choice">
              <legend>Animated images</legend>
              <p class="cv-note">
                {isAvif
                  ? 'AVIF output here is a still image: each frame becomes its own file, and you pick the ones to keep.'
                  : 'JPG cannot move: each frame becomes its own file, and you pick the ones to keep.'}
              </p>
            </fieldset>
          )}
          <Choice
            legend="HDR tone mapping"
            value={options.tone}
            options={[
              { value: 'brightness', label: 'Keep brightness', hint: 'Highlights stay bright and fade toward white.' },
              { value: 'colour', label: 'Keep colour', hint: 'Highlights keep their hue and get darker.' },
            ]}
            onChange={(tone) => onChange({ tone })}
          />
          <Choice
            legend="Colour profile"
            value={options.gamut}
            options={[
              { value: 'srgb', label: 'sRGB', hint: 'Looks right everywhere.' },
              { value: 'display-p3', label: 'Display P3', hint: 'Keeps wide-gamut colour; profile is embedded.' },
            ]}
            onChange={(gamut) => onChange({ gamut })}
            disabled={isAvif || (capabilities !== null && !capabilities.p3)}
            note={
              isAvif
                ? 'AVIF output is written in sRGB.'
                : capabilities && !capabilities.p3
                  ? 'This browser cannot read images in Display P3, so output is sRGB.'
                  : undefined
            }
          />
        </div>
      </details>
    </form>
  );
}

// ---------- results ----------

function badges(item: Item, canStepFrames: boolean): string[] {
  const detail = item.detail;
  if (!detail) return [];
  const out: string[] = [];
  if (detail.frameCount > 1) out.push(`Animated · ${detail.frameCount} frames`);
  else if (detail.info.animated)
    out.push(canStepFrames ? 'Animated · first frame' : 'Animated · first frame only in this browser');
  if (detail.info.hdr)
    out.push(
      detail.toneMapped
        ? `HDR ${detail.info.hdr.toUpperCase()} · tone-mapped`
        : `HDR ${detail.info.hdr.toUpperCase()} · rendered by browser`,
    );
  if (detail.info.bitDepth > 8) out.push(`${detail.info.bitDepth}-bit → 8-bit`);
  if (!detail.info.hdr && WIDE_PRIMARIES.has(detail.info.cicp?.primaries ?? 0)) out.push('Wide gamut');
  return out;
}

interface RowProps {
  item: Item;
  canStepFrames: boolean;
  store: ConverterStore;
  /** Where focus goes when the last row is removed. */
  fallbackFocus: RefObject<HTMLButtonElement | null>;
}

function Row({ item, canStepFrames, store, fallbackFocus }: RowProps) {
  const { detail, outputs } = item;
  const single = outputs.length === 1 && outputs[0].frame === null ? outputs[0] : null;
  const frames = single ? [] : outputs;
  const outputBytes = outputs.reduce((sum, output) => sum + output.blob.size, 0);
  const chosen = frames.filter((output) => output.selected).length;

  return (
    <li class="cv-row" data-status={item.status}>
      <div class="cv-thumb" aria-hidden="true">
        {(single ?? frames[0]) && <img src={(single ?? frames[0]).url} alt="" loading="lazy" decoding="async" />}
      </div>
      <div class="cv-main">
        <p class="cv-name">{item.file.name}</p>
        <p class="cv-meta">
          {detail && (
            <span>
              {detail.width}×{detail.height}
            </span>
          )}
          {badges(item, canStepFrames).map((badge) => (
            <span class="cv-badge">{badge}</span>
          ))}
        </p>
        {item.status === 'error' && <p class="cv-error">{item.error}</p>}
      </div>
      <p class="cv-size">
        {item.status === 'pending' && <span class="cv-working">Converting…</span>}
        {item.status === 'done' && (
          <>
            <span>
              {formatBytes(item.file.size)} → <strong>{formatBytes(outputBytes)}</strong>
            </span>
            <small>{sizeChange(item.file.size, outputBytes)}</small>
          </>
        )}
        {item.status === 'error' && <span class="cv-failed">Failed</span>}
      </p>
      <div class="cv-actions">
        {single && (
          <a class="btn btn-primary" href={single.url} download={single.name} aria-label={`Download ${single.name}`}>
            Download
          </a>
        )}
        <button
          type="button"
          class="btn btn-icon"
          aria-label={`Remove ${item.file.name}`}
          onClick={(event) => {
            // Keep the keyboard where it was: on the neighbouring row's remove button, or back on "Choose files".
            const row = event.currentTarget.closest('li');
            const neighbour = (
              row?.nextElementSibling ?? row?.previousElementSibling
            )?.querySelector<HTMLButtonElement>(':scope > .cv-actions > .btn-icon');
            store.remove(item.id);
            (neighbour ?? fallbackFocus.current)?.focus();
          }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" />
          </svg>
        </button>
      </div>
      {frames.length > 0 && (
        <div class="cv-frames">
          <p class="cv-frames-head">
            <span>
              {chosen} of {frames.length} frames selected
            </span>
            <button
              type="button"
              class="btn btn-quiet"
              onClick={() => store.selectAll(item.id, chosen < frames.length)}
            >
              {chosen < frames.length ? 'Select all' : 'Select none'}
            </button>
          </p>
          <ul aria-label={`Frames of ${item.file.name}`}>
            {frames.map((output, index) => (
              <li data-selected={output.selected ? '' : undefined}>
                <label>
                  <input
                    type="checkbox"
                    checked={output.selected}
                    aria-label={`Frame ${index + 1}`}
                    onChange={() => store.toggle(item.id, index)}
                  />
                  <img src={output.url} alt="" loading="lazy" decoding="async" />
                </label>
                <a href={output.url} download={output.name} aria-label={`Download ${output.name}`}>
                  {String(index + 1).padStart(3, '0')}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
