import { useRef } from 'react';
import { MicIcon } from './Icons';
import { useSpeech } from '../lib/speech';
import type { VoiceMode } from '../types';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  placeholder: string;
  voiceMode: VoiceMode;
  autoFocus?: boolean;
}

/** Text field with a mic inside it. Typing and speaking both end in onSubmit. */
export function VoiceBar({ value, onChange, onSubmit, placeholder, voiceMode, autoFocus }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const { listening, interim, fallback, setFallback, toggle } = useSpeech(voiceMode, (t) => onSubmit(t));

  const micTap = () => {
    const started = toggle();
    if (!started) input.current?.focus(); // keyboard up for iOS dictation, still inside the tap gesture
  };

  return (
    <div className="say">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) {
            onSubmit(value.trim());
            input.current?.blur();
          }
        }}
      >
        <input
          ref={input}
          value={listening ? interim : value}
          placeholder={listening ? 'Listening…' : placeholder}
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="off"
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setFallback(false)}
        />
        <button type="button" className={'mic' + (listening ? ' listening' : '')} onClick={micTap} aria-label={listening ? 'Stop listening' : 'Speak'}>
          <MicIcon />
        </button>
      </form>
      {fallback && <div className="hint">Tap the microphone on your keyboard and speak</div>}
    </div>
  );
}
