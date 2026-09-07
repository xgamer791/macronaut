import {
  assertImageSize,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_EDGE,
  scaleToFit,
} from '../pickedImage';

describe('picked profile images', () => {
  it('accepts a normal photo and refuses an empty or huge file', () => {
    expect(() => assertImageSize(400 * 1024)).not.toThrow();
    expect(() => assertImageSize(IMAGE_MAX_BYTES)).not.toThrow();
    expect(() => assertImageSize(IMAGE_MAX_BYTES + 1)).toThrow(/too large/i);
    expect(() => assertImageSize(0)).toThrow(/empty/i);
  });

  it('only scales down, and by the longest edge', () => {
    // Already small enough: left alone rather than upscaled.
    expect(scaleToFit(300, 200, 512)).toBe(1);
    expect(scaleToFit(512, 512, 512)).toBe(1);
    expect(scaleToFit(0, 0, 512)).toBe(1);

    // A portrait photo is bounded by its height, a landscape one by its width.
    expect(scaleToFit(1024, 512, 512)).toBe(0.5);
    expect(scaleToFit(512, 1024, 512)).toBe(0.5);
    expect(Math.round(4000 * scaleToFit(4000, 3000, 1600))).toBe(1600);
  });

  it('keeps the avatar smaller than the banner it sits on', () => {
    expect(IMAGE_MAX_EDGE.avatar).toBeLessThan(IMAGE_MAX_EDGE.banner);
  });
});
