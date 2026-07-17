/** Transcribe a recorded audio blob with the user's xAI Grok API key. */
export async function transcribeAudio(opts: {
  apiKey: string;
  blob: Blob;
  filename?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const key = opts.apiKey.trim();
  if (!key) throw new Error('Add your Grok API key in Settings first');

  const form = new FormData();
  form.append('language', 'en');
  form.append('format', 'true');
  form.append('keyterm', 'calories');
  form.append('keyterm', 'protein');
  form.append('keyterm', 'carbs');
  form.append('keyterm', 'macros');
  // file must be last per xAI STT docs
  const name = opts.filename ?? guessFilename(opts.blob.type);
  form.append('file', opts.blob, name);

  const res = await fetch('https://api.x.ai/v1/stt', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: opts.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error('Grok API key was rejected — check Settings');
    }
    if (res.status === 429) throw new Error('Grok rate limit hit — try again in a moment');
    throw new Error(errText.trim() || `Speech-to-text failed (${res.status})`);
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? '').trim();
  if (!text) throw new Error("I didn't catch that — hold the mic and try again");
  return text;
}

function guessFilename(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'voice.m4a';
  if (mime.includes('ogg')) return 'voice.ogg';
  if (mime.includes('wav')) return 'voice.wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'voice.mp3';
  return 'voice.webm';
}
