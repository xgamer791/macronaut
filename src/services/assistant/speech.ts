import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
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

export interface ListenResult {
  transcript: string;
}

/** Capture one spoken phrase via the Web Speech API. Rejects if unavailable or denied. */
export function listenOnce(opts?: { lang?: string; timeoutMs?: number }): Promise<ListenResult> {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    return Promise.reject(
      new Error('Voice input needs a browser that supports speech recognition (try Chrome).'),
    );
  }

  const timeoutMs = opts?.timeoutMs ?? 12_000;

  return new Promise((resolve, reject) => {
    const recognition = new Ctor();
    recognition.lang = opts?.lang ?? 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      reject(new Error('Listening timed out — tap the mic and try again'));
    }, timeoutMs);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? '';
      finish(() => {
        if (!transcript) reject(new Error('Could not hear that — try again'));
        else resolve({ transcript });
      });
    };

    recognition.onerror = (event) => {
      finish(() => {
        const code = event.error ?? 'failed';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          reject(new Error('Microphone permission denied — allow mic access and try again'));
        } else if (code === 'no-speech') {
          reject(new Error('No speech detected — tap the mic and speak'));
        } else {
          reject(new Error(`Voice input failed (${code})`));
        }
      });
    };

    recognition.onend = () => {
      // If we already resolved/rejected from onresult/onerror, ignore.
      finish(() => reject(new Error('Listening ended before a result')));
    };

    try {
      recognition.start();
    } catch (e) {
      finish(() =>
        reject(e instanceof Error ? e : new Error('Could not start the microphone')),
      );
    }
  });
}

/** Speak text aloud (expo-speech; works web + native). */
export function speakText(text: string): void {
  const clean = text.trim();
  if (!clean) return;
  try {
    Speech.stop();
    Speech.speak(clean, {
      language: 'en-US',
      rate: 1.0,
      pitch: 1.0,
    });
  } catch {
    // TTS is best-effort — never block the answer UI.
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
}
