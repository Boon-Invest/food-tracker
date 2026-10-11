import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceMode } from '../types';

// Minimal typing for Safari's prefixed Web Speech API
interface SRResult { 0: { transcript: string }; isFinal: boolean; length: number }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SR;

export function speechCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SILENCE_MS = 2000;

/**
 * Mic button behaviour: tap to start, second tap or ~2s of silence to stop.
 * If recognition is missing, blocked or fails, `fallback` is set and the caller
 * shows the text box with the keyboard dictation hint.
 */
export function useSpeech(mode: VoiceMode, onDone: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [fallback, setFallback] = useState(false);
  const rec = useRef<SR | null>(null);
  const finalText = useRef('');
  const interimText = useRef('');
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failed = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const clearSilence = () => {
    if (silence.current) clearTimeout(silence.current);
    silence.current = null;
  };

  const stop = useCallback(() => {
    clearSilence();
    rec.current?.stop();
  }, []);

  const start = useCallback((): boolean => {
    const Ctor = speechCtor();
    if (mode === 'keyboard' || !Ctor || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      setFallback(true);
      return false;
    }
    try {
      const r = new Ctor();
      r.lang = 'en-GB';
      r.continuous = true;
      r.interimResults = true;
      finalText.current = '';
      interimText.current = '';
      failed.current = false;
      r.onresult = (e) => {
        let fin = '';
        let inter = '';
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) fin += res[0].transcript + ' ';
          else inter += res[0].transcript + ' ';
        }
        finalText.current = fin;
        interimText.current = (fin + inter).trim();
        setInterim(interimText.current);
        clearSilence();
        silence.current = setTimeout(() => r.stop(), SILENCE_MS);
      };
      r.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          failed.current = true;
          setFallback(true);
        }
      };
      r.onend = () => {
        clearSilence();
        setListening(false);
        rec.current = null;
        // Safari sometimes only delivers interim results before ending
        const text = finalText.current.trim() || interimText.current;
        setInterim('');
        if (text && !failed.current) doneRef.current(text);
      };
      rec.current = r;
      r.start();
      setListening(true);
      setFallback(false);
      silence.current = setTimeout(() => r.stop(), SILENCE_MS + 3000); // nothing said at all
      return true;
    } catch {
      setFallback(true);
      return false;
    }
  }, [mode]);

  const toggle = useCallback((): boolean => {
    if (listening) {
      stop();
      return true;
    }
    return start();
  }, [listening, start, stop]);

  useEffect(() => () => rec.current?.abort(), []);

  return { listening, interim, fallback, setFallback, toggle };
}
