/** Shared shape and limits for a chat attachment. Pure, so the rules are the
 * same on web and native and can be tested without a picker. */

export type AttachmentKind = 'image' | 'video';

export interface PickedAttachment {
  kind: AttachmentKind;
  /** The bytes to upload. */
  blob: Blob;
  /** Something the composer can show straight away, before the upload lands. */
  previewUri: string;
  /** Pixel size of the original when the picker reported it, so the bubble
   * reserves the right shape and the thread does not jump on load. */
  width?: number;
  height?: number;
}

/** A chat photo is redrawn to this longest edge before upload — big enough to
 * fill a phone screen, small enough that a message sends over cell data. */
export const CHAT_IMAGE_MAX_EDGE = 1600;

/** Clips are uploaded as picked; a phone re-encode is a native-only trick and
 * not worth the wait here. This is the ceiling that keeps one message from
 * becoming a multi-minute upload. */
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export function assertAttachmentSize(kind: AttachmentKind, bytes: number): void {
  if (bytes === 0) throw new Error('That file was empty.');
  if (kind !== 'video') return;
  if (bytes > VIDEO_MAX_BYTES) {
    const mb = Math.round(VIDEO_MAX_BYTES / (1024 * 1024));
    throw new Error(`That video is too large. Pick one under ${mb} MB.`);
  }
}

/** What a picker was handed, by MIME type or by the picker's own label.
 * Anything that is not a video is treated as a picture, because that is the
 * only other thing either picker is allowed to return. */
export function attachmentKind(mimeType: string | undefined | null): AttachmentKind {
  return (mimeType ?? '').toLowerCase().startsWith('video/') ? 'video' : 'image';
}
