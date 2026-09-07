import { pushOffset, slideLayerTranslate } from '../slidePushLogic';

describe('slide push offsets', () => {
  it('moves the page the opposite way of the incoming panel', () => {
    expect(pushOffset('right', 390)).toBe(-390);
    expect(pushOffset('left', 390)).toBe(390);
  });

  it('parks a closed panel off-screen on its enter side', () => {
    expect(slideLayerTranslate('right', false, 390, null)).toBe(390);
    expect(slideLayerTranslate('left', false, 390, null)).toBe(-390);
    expect(slideLayerTranslate('right', true, 390, null)).toBe(0);
  });

  it('pushes an open panel out when another slide opens on top', () => {
    expect(slideLayerTranslate('left', true, 390, { from: 'left', open: true })).toBe(390);
    expect(slideLayerTranslate('right', true, 390, { from: 'right', open: true })).toBe(-390);
    expect(slideLayerTranslate('right', true, 390, { from: 'right', open: false })).toBe(0);
  });
});
