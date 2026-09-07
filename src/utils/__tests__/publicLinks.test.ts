import { photoShareUrl, profilePostShareUrl, profileShareUrl } from '../publicLinks';

describe('publicLinks', () => {
  it('builds a profile URL and a photo URL that opens the viewer', () => {
    expect(profileShareUrl('holly_ky')).toBe('https://xgamer791.github.io/macronaut/u/holly_ky');
    expect(photoShareUrl('holly_ky', 'photo-1')).toBe(
      'https://xgamer791.github.io/macronaut/photos?handle=holly_ky&photo=photo-1',
    );
    expect(photoShareUrl(undefined, 'photo-1')).toBe(
      'https://xgamer791.github.io/macronaut/photos?photo=photo-1',
    );
    expect(profilePostShareUrl('holly_ky', 'post 1')).toBe(
      'https://xgamer791.github.io/macronaut/u/holly_ky?post=post%201',
    );
  });
});
