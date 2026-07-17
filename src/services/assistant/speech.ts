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

export interface LiveTranscriptSession {
  /** Stop recognition and return the best transcript so far (or null). */
  stop: () => Promise<string | null>;
  abort: () => void;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((ev: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the browser can stream live transcripts while holding the mic. */
export function canLiveTranscript(): boolean {
  return Platform.OS === 'web' && !!getSpeechRecognitionCtor();
}

/**
 * Parallel live STT via Web Speech API — often finishes before xAI STT.
 * Returns null from stop() when unsupported or nothing was heard.
 */
export function startLiveTranscript(): LiveTranscriptSession {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    return { stop: async () => null, abort: () => {} };
  }

  let finalText = '';
  let interimText = '';
  let settled = false;
  let stopResolver: ((text: string | null) => void) | null = null;
  let rec: SpeechRecognitionLike | null = null;

  try {
    rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0]?.transcript ?? '';
        if (ev.results[i].isFinal) finalText = `${finalText} ${piece}`.trim();
        else interim += piece;
      }
      interimText = interim.trim();
    };
    rec.onerror = () => {
      /* keep whatever we have; stop() will read it */
    };
    rec.onend = () => {
      if (settled) return;
      settled = true;
      const text = (finalText || interimText).trim() || null;
      stopResolver?.(text);
      stopResolver = null;
    };
    rec.start();
  } catch {
    return { stop: async () => null, abort: () => {} };
  }

  return {
    stop: () =>
      new Promise((resolve) => {
        if (settled) {
          resolve((finalText || interimText).trim() || null);
          return;
        }
        stopResolver = resolve;
        try {
          rec?.stop();
        } catch {
          settled = true;
          resolve((finalText || interimText).trim() || null);
        }
        // Safari sometimes never fires onend after stop().
        setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve((finalText || interimText).trim() || null);
          stopResolver = null;
        }, 600);
      }),
    abort: () => {
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
      settled = true;
      stopResolver?.(null);
      stopResolver = null;
    },
  };
}

/** Prefer a middle-aged / adult female American voice when available. */
function pickFemaleAmericanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  if (!voices.length) return null;

  const enUs = voices.filter((v) => /^en(-|_)US$/i.test(v.lang) || /en-US/i.test(v.lang));
  const pool = enUs.length ? enUs : voices.filter((v) => /^en/i.test(v.lang));
  const preferred = [
    /samantha/i,
    /karen/i,
    /susan/i,
    /moira/i,
    /fiona/i,
    /victoria/i,
    /zira/i,
    /google us english.*female/i,
    /microsoft.*(aria|jenny|sara|guy)/i,
    /female/i,
  ];
  for (const re of preferred) {
    const hit = pool.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  // Avoid obviously male names when we can.
  const notMale = pool.find((v) => !/david|mark|fred|daniel|alex|tom|male/i.test(v.name));
  return notMale ?? pool[0] ?? null;
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

/** Fallback speak via speechSynthesis / expo-speech (female American when available). */
export function speakText(text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
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
        // Voices may load async — try once more if empty.
        let voice = pickFemaleAmericanVoice();
        if (!voice) {
          try {
            synth.getVoices();
          } catch {
            /* ignore */
          }
          voice = pickFemaleAmericanVoice();
        }
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = 'en-US';
        u.rate = 1.08;
        u.pitch = 1.0;
        if (voice) u.voice = voice;
        u.onend = () => {
          clearTimeout(fallback);
          done();
        };
        u.onerror = () => {
          clearTimeout(fallback);
          fail(new Error('Browser speech failed'));
        };
        synth.speak(u);
        return;
      }
      Speech.stop();
      Speech.speak(clean, {
        language: 'en-US',
        rate: 1.08,
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
          fail(new Error('Speech failed'));
        },
      });
    } catch (e) {
      clearTimeout(fallback);
      fail(e instanceof Error ? e : new Error('Speech failed'));
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
