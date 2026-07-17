import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

let sharedStream: MediaStream | null = null;
let sharedAudioCtx: AudioContext | null = null;

/** True when this environment can hold-to-record microphone audio. */
export function canHoldRecord(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    (typeof AudioContext !== 'undefined' || typeof w.webkitAudioContext !== 'undefined')
  );
}

/** @deprecated Use canHoldRecord */
export function isSpeechRecognitionAvailable(): boolean {
  return canHoldRecord();
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Create/resume an AudioContext inside a user gesture (press).
 * iOS Safari suspends contexts until resume() runs in a gesture.
 */
export async function unlockAudioContext(): Promise<AudioContext> {
  const Ctor = getAudioContextCtor();
  if (!Ctor) throw new Error('Audio recording is not supported in this browser');
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new Ctor();
  }
  if (sharedAudioCtx.state === 'suspended') {
    await sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

/** Warm the mic (permission + stream). Safe to call repeatedly. */
export async function ensureMicStream(): Promise<MediaStream> {
  if (!canHoldRecord()) throw new Error('Microphone recording is not supported in this browser');
  const live = sharedStream?.getAudioTracks().some((t) => t.readyState === 'live');
  if (sharedStream && live) {
    sharedStream.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
    return sharedStream;
  }

  sharedStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
    video: false,
  });
  sharedStream.getAudioTracks().forEach((t) => {
    t.enabled = true;
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
  try {
    void sharedAudioCtx?.close();
  } catch {
    /* ignore */
  }
  sharedAudioCtx = null;
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
    /microsoft.*(aria|jenny|sara)/i,
    /female/i,
  ];
  for (const re of preferred) {
    const hit = pool.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  const notMale = pool.find((v) => !/david|mark|fred|daniel|alex|tom|male/i.test(v.name));
  return notMale ?? pool[0] ?? null;
}

/** Encode mono float32 PCM samples as a 16-bit WAV blob. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function mergeFloat32(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Hold-to-talk recorder using AudioContext PCM → WAV.
 * More reliable than MediaRecorder on mobile Safari (which often returns empty blobs).
 * Prefer calling unlockAudioContext() + ensureMicStream() on press first.
 * Falls back to MediaRecorder if the PCM graph never produces samples.
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

  const chunks: Float32Array[] = [];
  const mrChunks: BlobPart[] = [];
  let settled = false;
  let stopResolver: ((blob: Blob) => void) | null = null;
  let stopRejecter: ((err: Error) => void) | null = null;
  let started = false;
  let localStream = stream ?? null;
  let ownsStream = !stream;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let silent: GainNode | null = null;
  let clonedTrack: MediaStreamTrack | null = null;
  let recorder: MediaRecorder | null = null;
  let mrMime = 'audio/webm';
  let sampleRate = 44100;

  const teardownGraph = () => {
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    } catch {
      /* ignore */
    }
    try {
      processor?.disconnect();
      source?.disconnect();
      silent?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      clonedTrack?.stop();
    } catch {
      /* ignore */
    }
    processor = null;
    source = null;
    silent = null;
    clonedTrack = null;
    recorder = null;
  };

  const settle = (blob: Blob) => {
    if (settled) return;
    settled = true;
    teardownGraph();
    if (ownsStream) {
      try {
        localStream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      if (localStream === sharedStream) sharedStream = null;
    }
    localStream = null;
    stopResolver?.(blob);
    stopResolver = null;
    stopRejecter = null;
  };

  const fail = (err: Error) => {
    if (settled) return;
    settled = true;
    teardownGraph();
    if (ownsStream) {
      try {
        localStream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      if (localStream === sharedStream) sharedStream = null;
    }
    localStream = null;
    stopRejecter?.(err);
    stopResolver = null;
    stopRejecter = null;
  };

  const pickMime = (): string | undefined => {
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
  };

  const boot = (async () => {
    try {
      const ctx = await unlockAudioContext();
      sampleRate = ctx.sampleRate || 44100;

      if (!localStream) {
        localStream = await ensureMicStream();
        ownsStream = false;
      }
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });

      const track = localStream.getAudioTracks()[0];
      if (!track || track.readyState !== 'live') {
        throw new Error('Microphone is not ready — tap the mic once, then hold and speak');
      }

      // Primary: PCM via AudioContext (works on iOS Safari).
      try {
        clonedTrack = track.clone();
        const captureStream = new MediaStream([clonedTrack]);
        source = ctx.createMediaStreamSource(captureStream);
        processor = ctx.createScriptProcessor(4096, 1, 1);
        silent = ctx.createGain();
        silent.gain.value = 0;
        processor.onaudioprocess = (e) => {
          if (settled) return;
          chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };
        source.connect(processor);
        processor.connect(silent);
        silent.connect(ctx.destination);
      } catch {
        // PCM graph failed — MediaRecorder-only below.
      }

      // Secondary: MediaRecorder on the shared stream (no timeslice — Safari-safe).
      if (typeof MediaRecorder !== 'undefined') {
        try {
          const mime = pickMime();
          recorder = mime
            ? new MediaRecorder(localStream, { mimeType: mime })
            : new MediaRecorder(localStream);
          mrMime = recorder.mimeType || mime || 'audio/webm';
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) mrChunks.push(e.data);
          };
          // No timeslice — Safari often returns empty blobs with start(ms).
          recorder.start();
        } catch {
          recorder = null;
        }
      }

      if (!processor && !recorder) {
        throw new Error('Could not start microphone recording');
      }
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
          resolve(encodeWav(mergeFloat32(chunks), sampleRate));
          return;
        }
        stopResolver = resolve;
        stopRejecter = reject;

        const waitStart = Date.now();
        while (!started && !settled && Date.now() - waitStart < 4000) {
          await new Promise((r) => setTimeout(r, 40));
        }
        if (settled) return;

        await new Promise((r) => setTimeout(r, 150));

        const pcm = mergeFloat32(chunks);
        // Prefer PCM WAV when we actually captured samples.
        if (pcm.length > 2048) {
          settle(encodeWav(pcm, sampleRate));
          return;
        }

        // Fall back to MediaRecorder blob.
        if (recorder && recorder.state !== 'inactive') {
          await new Promise<void>((res) => {
            const done = () => res();
            recorder!.onstop = done;
            try {
              recorder!.stop();
            } catch {
              done();
            }
            setTimeout(done, 800);
          });
        }
        const mrBlob = new Blob(mrChunks, { type: mrMime });
        if (mrBlob.size > 500) {
          settle(mrBlob);
          return;
        }

        // Last resort: whatever PCM we have (may be short).
        settle(encodeWav(pcm, sampleRate));
      }),
    abort: () => {
      settle(new Blob([], { type: 'audio/wav' }));
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
