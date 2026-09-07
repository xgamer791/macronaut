import {
  assertAttachmentSize,
  attachmentKind,
  CHAT_IMAGE_MAX_EDGE,
  VIDEO_MAX_BYTES,
} from '../pickedAttachment';
import { IMAGE_MAX_EDGE } from '../pickedImage';

describe('chat attachments', () => {
  it('reads the kind off the MIME type, and treats anything else as a picture', () => {
    expect(attachmentKind('video/mp4')).toBe('video');
    expect(attachmentKind('VIDEO/QUICKTIME')).toBe('video');
    expect(attachmentKind('image/jpeg')).toBe('image');
    expect(attachmentKind('image/heic')).toBe('image');
    // A picker that reports nothing still has to return something sendable.
    expect(attachmentKind(undefined)).toBe('image');
    expect(attachmentKind('')).toBe('image');
  });

  it('caps a clip and refuses an empty file of either kind', () => {
    expect(() => assertAttachmentSize('video', VIDEO_MAX_BYTES)).not.toThrow();
    expect(() => assertAttachmentSize('video', VIDEO_MAX_BYTES + 1)).toThrow(/too large/i);
    expect(() => assertAttachmentSize('video', 0)).toThrow(/empty/i);
    expect(() => assertAttachmentSize('image', 0)).toThrow(/empty/i);
  });

  it('leaves a photo uncapped by bytes — the picker downscales it first', () => {
    expect(() => assertAttachmentSize('image', VIDEO_MAX_BYTES * 2)).not.toThrow();
    expect(CHAT_IMAGE_MAX_EDGE).toBe(IMAGE_MAX_EDGE.post);
  });
});
