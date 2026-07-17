import { transcribeAudio } from '../stt';

describe('transcribeAudio', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requires an API key', async () => {
    await expect(
      transcribeAudio({ apiKey: '', blob: new Blob(['x'], { type: 'audio/webm' }) }),
    ).rejects.toThrow(/Grok API key/);
  });

  it('posts multipart audio and returns text', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ text: 'How much protein do I have left?' }),
    })) as unknown as typeof fetch;

    const text = await transcribeAudio({
      apiKey: 'xai-test',
      blob: new Blob(['fake'], { type: 'audio/webm' }),
    });
    expect(text).toContain('protein');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.x.ai/v1/stt',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer xai-test' }),
      }),
    );
  });
});
