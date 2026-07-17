/** Speak text via xAI TTS and play it in the browser. */
export async function speakWithGrokTts(opts: {
  apiKey: string;
  text: string;
  voiceId?: string;
  signal?: AbortSignal;
}): Promise<void> {
  const key = opts.apiKey.trim();
  const text = opts.text.trim();
  if (!key || !text) return;

  const res = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice_id: opts.voiceId ?? 'eve',
      language: 'en',
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error('Grok API key was rejected — check Settings');
    }
    throw new Error(errText.trim() || `Text-to-speech failed (${res.status})`);
  }

  const blob = await res.blob();
  await playAudioBlob(blob);
}

/** Tiny silent WAV used to unlock HTMLAudioElement inside a user gesture. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let sharedAudio: HTMLAudioElement | null = null;

/** Call on mic press so later TTS playback is allowed on iOS Safari. */
export function unlockAudioElement(): void {
  if (typeof Audio === 'undefined') return;
  try {
    if (!sharedAudio) sharedAudio = new Audio();
    sharedAudio.src = SILENT_WAV;
    void sharedAudio.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function stopAudioElement(): void {
  try {
    if (sharedAudio) {
      sharedAudio.pause();
      sharedAudio.removeAttribute('src');
      sharedAudio.load();
    }
  } catch {
    /* ignore */
  }
}

function playAudioBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof Audio === 'undefined') {
      reject(new Error('Audio playback is not available'));
      return;
    }
    const url = URL.createObjectURL(blob);
    if (!sharedAudio) sharedAudio = new Audio();
    const audio = sharedAudio;
    const done = () => {
      URL.revokeObjectURL(url);
      audio.onended = null;
      audio.onerror = null;
      resolve();
    };
    audio.onended = done;
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not play the spoken reply'));
    };
    audio.src = url;
    void audio.play().catch((e) => {
      URL.revokeObjectURL(url);
      reject(e instanceof Error ? e : new Error('Playback blocked'));
    });
  });
}
