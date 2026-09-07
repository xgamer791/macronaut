/** Shared shape and limits for a picked profile image. Pure, so the rules are
 * the same on web and native and can be tested without a picker. */

export interface PickedImage {
  /** The bytes to upload. */
  blob: Blob;
  /** Something an `<Image>` can show straight away, before the upload lands. */
  previewUri: string;
}

/** What the profile picture and the banner are scaled to before upload. Both
 * are displayed small, and Convex storage bills by the byte, so there is no
 * reason to keep a 12-megapixel original. */
export const IMAGE_MAX_EDGE = { avatar: 512, banner: 1600, post: 1600 } as const;

export type ImageSlot = keyof typeof IMAGE_MAX_EDGE;

/** Cap for one gallery pick. The wall itself holds more; this keeps a single
 * upload batch from stalling the picker. */
export const GALLERY_SELECTION_LIMIT = 20;

/** Native library options for the photo wall. Multi-select with numbered
 * badges so a tap only toggles — it does not open a crop or preview — and
 * the returned assets stay in tap order. */
export const GALLERY_PICKER_OPTIONS = {
  allowsEditing: false,
  allowsMultipleSelection: true,
  orderedSelection: true,
  selectionLimit: GALLERY_SELECTION_LIMIT,
  quality: 0.85,
};

/** Refuse anything absurd. The web picker downscales first, so hitting this
 * means the file was not really a photo. */
export const IMAGE_MAX_BYTES = 12 * 1024 * 1024;

export function assertImageSize(bytes: number): void {
  if (bytes > IMAGE_MAX_BYTES) {
    const mb = Math.round(IMAGE_MAX_BYTES / (1024 * 1024));
    throw new Error(`That image is too large. Pick one under ${mb} MB.`);
  }
  if (bytes === 0) throw new Error('That file was empty.');
}

/** Longest-edge scale factor, or 1 when the image is already small enough. */
export function scaleToFit(width: number, height: number, maxEdge: number): number {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return 1;
  return maxEdge / longest;
}
