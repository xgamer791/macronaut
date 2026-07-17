import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

/** True when this environment can hold-to-record microphone audio. */
export function canHoldRecord(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

/** @deprecated Use canHoldRecord — kept for older call sites. */
export function isSpeechRecognitionAvailable(): boolean {
  return canHoldRecord() || getSpeechRecognitionCtor() != null;
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
    // Resume if the engine is stuck paused (common on iOS).
    try {
      synth.resume();
    } catch {
      /* ignore */
    }
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0;
    warm.rate = 2;
    synth.speak(warm);
  } catch {
    /* ignore */
  }
}

export interface HoldListenSession {
  /** Stop recording and resolve with an audio blob (may be empty). */
  stop: () => Promise<Blob>;
  /** Cancel without waiting for audio. */
  abort: () => void;
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

/**
 * Hold-to-talk recorder: start on press-in, stop() on press-out → audio Blob.
 * Uses MediaRecorder (reliable on mobile Safari) instead of Web Speech API.
 */
export function startHoldListen(): HoldListenSession {
  if (!canHoldRecord()) {
    return {
      stop: async () => {
        throw new Error('Microphone recording is not supported in this browser');
      },
      abort: () => {},
    };
  }

  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  const chunks: BlobPart[] = [];
  let mime = pickRecorderMime();
  let settled = false;
  let stopResolver: ((blob: Blob) => void) | null = null;
  let stopRejecter: ((err: Error) => void) | null = null;
  let started = false;

  const settle = (blob: Blob) => {
    if (settled) return;
    settled = true;
    cleanupStream();
    stopResolver?.(blob);
    stopResolver = null;
    stopRejecter = null;
  };

  const fail = (err: Error) => {
    if (settled) return;
    settled = true;
    cleanupStream();
    stopRejecter?.(err);
    stopResolver = null;
    stopRejecter = null;
  };

  const cleanupStream = () => {
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    stream = null;
    recorder = null;
  };

  const boot = (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
        video: false,
      });
      const opts = mime ? { mimeType: mime } : undefined;
      try {
        recorder = opts ? new MediaRecorder(stream, opts) : new MediaRecorder(stream);
      } catch {
        recorder = new MediaRecorder(stream);
        mime = recorder.mimeType || mime;
      }
      mime = recorder.mimeType || mime || 'audio/webm';

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = () => fail(new Error('Microphone recording failed'));
      recorder.onstop = () => {
        const type = mime || 'audio/webm';
        settle(new Blob(chunks, { type }));
      };

      // timeslice keeps data flowing on Safari
      recorder.start(250);
      started = true;
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone permission denied — allow mic access and try again'
          : e instanceof Error
            ? e.message
            : 'Could not open the microphone';
      fail(new Error(msg));
    }
  })();

  return {
    stop: () =>
      new Promise<Blob>(async (resolve, reject) => {
        await boot;
        if (settled) {
          resolve(new Blob(chunks, { type: mime || 'audio/webm' }));
          return;
        }
        stopResolver = resolve;
        stopRejecter = reject;
        if (!recorder || !started) {
          // Still starting — wait briefly then stop.
          const waitStart = Date.now();
          while (!started && !settled && Date.now() - waitStart < 2500) {
            await new Promise((r) => setTimeout(r, 50));
          }
        }
        if (settled) return;
        if (!recorder || recorder.state === 'inactive') {
          settle(new Blob(chunks, { type: mime || 'audio/webm' }));
          return;
        }
        try {
          if (recorder.state === 'recording') recorder.requestData?.();
          recorder.stop();
        } catch {
          settle(new Blob(chunks, { type: mime || 'audio/webm' }));
        }
        setTimeout(() => settle(new Blob(chunks, { type: mime || 'audio/webm' })), 800);
      }),
    abort: () => {
      try {
        if (recorder && recorder.state !== 'inactive') recorder.stop();
      } catch {
        /* ignore */
      }
      settle(new Blob());
    },
  };
}

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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

    const fallback = setTimeout(done, Math.min(60_000, 1600 + clean.length * 55));

    try {
      // Prefer direct speechSynthesis on web — more reliable onDone than expo wrapper.
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        const synth = window.speechSynthesis;
        try {
          synth.cancel();
          synth.resume();
        } catch {
          /* ignore */
        }
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = 'en-US';
        u.rate = 1.05;
        u.onend = () => {
          clearTimeout(fallback);
          done();
        };
        u.onerror = () => {
          clearTimeout(fallback);
          done();
        };
        synth.speak(u);
        return;
      }

      Speech.stop();
      Speech.speak(clean, {
        language: 'en-US',
        rate: 1.05,
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
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
    Speech.stop();
  } catch {
    /* ignore */
  }
}
