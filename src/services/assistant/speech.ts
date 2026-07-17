import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

let sharedStream: MediaStream | null = null;

/** True when this environment can hold-to-record microphone audio. */
export function canHoldRecord(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

/** @deprecated Use canHoldRecord */
export function isSpeechRecognitionAvailable(): boolean {
  return canHoldRecord();
}

/** Warm the mic (permission + stream). Safe to call repeatedly. */
export async function ensureMicStream(): Promise<MediaStream> {
  if (!canHoldRecord()) throw new Error('Microphone recording is not supported in this browser');
  const live = sharedStream?.getAudioTracks().some((t) => t.readyState === 'live');
  if (sharedStream && live) return sharedStream;

  sharedStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
    video: false,
  });
  return sharedStream;
}

export function releaseMicStream(): void {
  try {
    sharedStream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  sharedStream = null;
}

/**
 * Unlock browser speechSynthesis inside a user-gesture handler.
 * Prefer unlockAudioElement + Grok TTS for spoken replies.
 */
export function unlockSpeechPlayback(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
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
  abort: () => void;
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/mp4',
    'audio/aac',
    'audio/webm;codecs=opus',
    'audio/webm',
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
 * Hold-to-talk recorder against a live mic stream.
 * Prefer calling ensureMicStream() before this so permission is already granted.
 */
export function startHoldListen(stream?: MediaStream): HoldListenSession {
  if (!canHoldRecord()) {
    return {
      stop: async () => {
        throw new Error('Microphone recording is not supported in this browser');
      },
      abort: () => {},
    };
  }

  let recorder: MediaRecorder | null = null;
  const chunks: BlobPart[] = [];
  let mime = pickRecorderMime();
  let settled = false;
  let stopResolver: ((blob: Blob) => void) | null = null;
  let stopRejecter: ((err: Error) => void) | null = null;
  let started = false;
  let localStream = stream ?? null;
  let ownsStream = !stream;

  const settle = (blob: Blob) => {
    if (settled) return;
    settled = true;
    // Don't stop shared tracks — only stop if we opened our own.
    if (ownsStream) {
      try {
        localStream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      if (localStream === sharedStream) sharedStream = null;
    }
    localStream = null;
    recorder = null;
    stopResolver?.(blob);
    stopResolver = null;
    stopRejecter = null;
  };

  const fail = (err: Error) => {
    if (settled) return;
    settled = true;
    if (ownsStream) {
      try {
        localStream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      if (localStream === sharedStream) sharedStream = null;
    }
    localStream = null;
    recorder = null;
    stopRejecter?.(err);
    stopResolver = null;
    stopRejecter = null;
  };

  const boot = (async () => {
    try {
      if (!localStream) {
        localStream = await ensureMicStream();
        ownsStream = false; // shared
      }
      const opts = mime ? { mimeType: mime } : undefined;
      try {
        recorder = opts ? new MediaRecorder(localStream, opts) : new MediaRecorder(localStream);
      } catch {
        recorder = new MediaRecorder(localStream);
      }
      mime = recorder.mimeType || mime || 'audio/mp4';

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = () => fail(new Error('Microphone recording failed'));
      recorder.onstop = () => {
        settle(new Blob(chunks, { type: mime || 'audio/mp4' }));
      };

      recorder.start(200);
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
          resolve(new Blob(chunks, { type: mime || 'audio/mp4' }));
          return;
        }
        stopResolver = resolve;
        stopRejecter = reject;

        const waitStart = Date.now();
        while (!started && !settled && Date.now() - waitStart < 3000) {
          await new Promise((r) => setTimeout(r, 40));
        }
        if (settled) return;

        // Give Safari a beat to buffer audio before stop.
        await new Promise((r) => setTimeout(r, 180));

        if (!recorder || recorder.state === 'inactive') {
          settle(new Blob(chunks, { type: mime || 'audio/mp4' }));
          return;
        }
        try {
          if (recorder.state === 'recording') {
            try {
              recorder.requestData?.();
            } catch {
              /* ignore */
            }
          }
          recorder.stop();
        } catch {
          settle(new Blob(chunks, { type: mime || 'audio/mp4' }));
        }
        setTimeout(() => settle(new Blob(chunks, { type: mime || 'audio/mp4' })), 1000);
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

/** Fallback speak via speechSynthesis / expo-speech. */
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
    const fallback = setTimeout(done, Math.min(45_000, 1400 + clean.length * 50));

    try {
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
