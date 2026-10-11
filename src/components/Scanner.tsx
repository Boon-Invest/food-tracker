import { useEffect, useRef, useState } from 'react';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface Detector {
  detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

let detectorPromise: Promise<Detector> | null = null;

/** Native BarcodeDetector where it exists, otherwise the zxing-wasm polyfill served from our own origin. */
function getDetector(): Promise<Detector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const native = (window as unknown as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      if (native?.getSupportedFormats) {
        const supported = await native.getSupportedFormats();
        if (FORMATS.some((f) => supported.includes(f))) return new native({ formats: FORMATS });
      }
      const mod = await import('barcode-detector/ponyfill');
      mod.prepareZXingModule({
        overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) }
      });
      return new mod.BarcodeDetector({ formats: FORMATS as never[] }) as unknown as Detector;
    })();
  }
  return detectorPromise;
}

export function Scanner({ onDetected, onCancel }: { onDetected: (code: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [msg, setMsg] = useState('Starting camera…');
  const [manual, setManual] = useState('');
  const [camFailed, setCamFailed] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        if (stopped) return;
        const v = video.current!;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        await v.play();
        setMsg('Point at the barcode');
        const det = await getDetector();
        const loop = async () => {
          if (stopped || done.current) return;
          try {
            if (v.readyState >= 2) {
              const codes = await det.detect(v);
              const hit = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
              if (hit && !done.current) {
                done.current = true;
                navigator.vibrate?.(60);
                onDetected(hit.rawValue);
                return;
              }
            }
          } catch {
            // keep trying
          }
          timer = setTimeout(loop, 120);
        };
        loop();
      } catch {
        setCamFailed(true);
        setMsg('Camera not available');
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div>
      {!camFailed && (
        <div className="scan-wrap">
          <video ref={video} muted playsInline autoPlay />
          <div className="scan-frame" />
          <div className="scan-msg">{msg}</div>
        </div>
      )}
      {camFailed && <div className="banner err">Couldn't open the camera. Type the barcode instead, or allow camera access in Settings.</div>}
      <div className="field">
        <label>Or type the barcode</label>
        <div className="field-row">
          <input inputMode="numeric" value={manual} placeholder="e.g. 5000112548167" onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} />
          <button className="btn" style={{ flex: '0 0 auto' }} disabled={manual.length < 8} onClick={() => onDetected(manual)}>
            Look up
          </button>
        </div>
      </div>
      <button className="btn block" onClick={onCancel}>Cancel</button>
    </div>
  );
}
