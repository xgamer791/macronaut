export type SlideSide = 'left' | 'right';

export function pushOffset(from: SlideSide, width: number): number {
  return from === 'right' ? -width : width;
}

export function slideLayerTranslate(
  from: SlideSide,
  open: boolean,
  width: number,
  above: { from: SlideSide; open: boolean } | null,
): number {
  if (above?.open) return pushOffset(above.from, width);
  return open ? 0 : from === 'right' ? width : -width;
}
