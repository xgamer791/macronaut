import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

type SpeechResultList = {
  length: number;
  [index: number]: { isFinal?: boolean; [index: number]: { transcript: string } };
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the browser can do microphone speech-to-text. */
export function isSpeechRecognitionAvailable(): boolean {
  return getSpeechRecognitionCtor() != null;
}

/**
 * Unlock browser speechSynthesis inside a user-gesture handler (required on
 * iOS Safari after async work). Call this when the mic FAB is pressed.
 */
export function unlockSpeechPlayback(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0;
    warm.rate = 2;
    synth.speak(warm);
    synth.cancel();
  } catch {
    /* ignore */
  }
}

export interface HoldListenSession {
  /** Stop listening and resolve with the final transcript (may be empty). */
  stop: () => Promise<string>;
  /** Cancel without waiting for a transcript. */
  abort: () => void;
}

/**
 * Hold-to-talk: start on press-in, call stop() on press-out to get the phrase.
 * Uses continuous recognition so speech accumulates while the button is held.
 */
export function startHoldListen(opts?: { lang?: string }): HoldListenSession {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    return {
      stop: async () => {
        throw new Error('Voice input needs a browser that supports speech recognition (try Chrome).');
      },
      abort: () => {},
    };
  }

  const recognition = new Ctor();
  recognition.lang = opts?.lang ?? 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = '';
  let interimText = '';
  let settled = false;
  let stopResolver: ((text: string) => void) | null = null;
  let stopRejecter: ((err: Error) => void) | null = null;
  let stopping = false;

  const settleStop = (text: string) => {
    if (settled) return;
    settled = true;
    stopResolver?.(text);
    stopResolver = null;
    stopRejecter = null;
  };

  const settleError = (err: Error) => {
    if (settled) return;
    settled = true;
    stopRejecter?.(err);
    stopResolver = null;
    stopRejecter = null;
  };

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i]?.[0]?.transcript ?? '';
      if (event.results[i]?.isFinal) {
        finalText = `${finalText} ${piece}`.trim();
        interimText = '';
      } else {
        interim += piece;
      }
    }
    if (interim) interimText = interim.trim();
  };

  recognition.onerror = (event) => {
    const code = event.error ?? 'failed';
    // "aborted" / "no-speech" while stopping is fine — return what we have.
    if (stopping && (code === 'aborted' || code === 'no-speech')) {
      settleStop((finalText || interimText).trim());
      return;
    }
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      settleError(new Error('Microphone permission denied — allow mic access and try again'));
      return;
    }
    if (stopping) {
      settleStop((finalText || interimText).trim());
      return;
    }
    settleError(new Error(`Voice input failed (${code})`));
  };

  recognition.onend = () => {
    settleStop((finalText || interimText).trim());
  };

  try {
    recognition.start();
  } catch (e) {
    settleError(e instanceof Error ? e : new Error('Could not start the microphone'));
  }

  return {
    stop: () =>
      new Promise<string>((resolve, reject) => {
        if (settled) {
          resolve((finalText || interimText).trim());
          return;
        }
        stopping = true;
        stopResolver = resolve;
        stopRejecter = reject;
        try {
          recognition.stop();
        } catch {
          settleStop((finalText || interimText).trim());
        }
        // Some engines never fire onend after stop — fall back quickly.
        setTimeout(() => settleStop((finalText || interimText).trim()), 600);
      }),
    abort: () => {
      stopping = true;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      settleStop('');
    },
  };
}

/** Speak text aloud and resolve when finished (or on error / empty). */
export function speakText(text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    // Safety net if onDone never fires (some web engines).
    const fallback = setTimeout(done, Math.min(60_000, 1800 + clean.length * 60));

    try {
      Speech.stop();
      Speech.speak(clean, {
        language: 'en-US',
        rate: Platform.OS === 'ios' ? 1.05 : 1.08,
        pitch: 1.0,
        onDone: () => {
          clearTimeout(fallback);
          done();
        },
        onStopped: () => {
          clearTimeout(fallback);
          done();
        },
        onError: () => {
          clearTimeout(fallback);
          done();
        },
      });
    } catch {
      clearTimeout(fallback);
      done();
    }
  });
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
}
