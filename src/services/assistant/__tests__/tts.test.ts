import { speakWithGrokTts } from '../tts';

describe('speakWithGrokTts', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('posts TTS and plays the returned audio', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['abc'], { type: 'audio/mpeg' }),
    })) as unknown as typeof fetch;

    const play = jest.fn(async () => undefined);
    let ended: (() => void) | null = null;
    const fakeAudio = {
      src: '',
      set onended(fn: (() => void) | null) {
        ended = fn;
      },
      get onended() {
        return ended;
      },
      onerror: null as (() => void) | null,
      play: async () => {
        await play();
        ended?.();
      },
      pause: jest.fn(),
      load: jest.fn(),
      removeAttribute: jest.fn(),
    };

    Object.assign(globalThis, {
      Audio: jest.fn(() => fakeAudio),
      URL: {
        ...URL,
        createObjectURL: jest.fn(() => 'blob:fake'),
        revokeObjectURL: jest.fn(),
      },
    });

    await speakWithGrokTts({ apiKey: 'xai-test', text: 'Hello there' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.x.ai/v1/tts',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(play).toHaveBeenCalled();
  });
});
