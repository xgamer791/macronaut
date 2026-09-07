import {
  assertAttachmentSize,
  attachmentKind,
  CHAT_IMAGE_MAX_EDGE,
  PickedAttachment,
} from './pickedAttachment';
import { scaleToFit } from './pickedImage';

/**
 * Web picker for one chat attachment. A hidden `<input type="file">` rather
 * than `expo-image-picker`, for the same reason the profile picker uses one:
 * it is the browser's own dialog, needs no permission prompt, and keeps the
 * native module out of the bundle.
 *
 * A photo is redrawn through a canvas first, so a phone camera shot arrives
 * as a few hundred kilobytes. A clip is uploaded as picked — re-encoding
 * video in a canvas is not something a browser can do cheaply.
 */
export async function pickAttachment(): Promise<PickedAttachment | null> {
  const file = await chooseFile(false);
  return file ? attachmentFromFile(file) : null;
}

/** Ask a phone browser for its rear camera; desktop browsers fall back to a file chooser. */
export async function takePhotoAttachment(): Promise<PickedAttachment | null> {
  const file = await chooseFile(true);
  return file ? attachmentFromFile(file) : null;
}

async function attachmentFromFile(file: File): Promise<PickedAttachment> {
  const kind = attachmentKind(file.type);
  if (kind === 'video') {
    assertAttachmentSize('video', file.size);
    const previewUri = URL.createObjectURL(file);
    return { kind, blob: file, previewUri, ...(await videoSize(previewUri)) };
  }

  const { blob, width, height } = await downscale(file, CHAT_IMAGE_MAX_EDGE);
  assertAttachmentSize('image', blob.size);
  return { kind: 'image', blob, previewUri: URL.createObjectURL(blob), width, height };
}

function chooseFile(camera: boolean): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = camera ? 'image/*' : 'image/*,video/*';
    if (camera) input.capture = 'environment';
    input.style.display = 'none';
    // Firefox needs the input in the document for `click()` to open a dialog.
    document.body.appendChild(input);

    let settled = false;
    const finish = (picked: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(picked);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    // Chrome and Safari fire `cancel` when the dialog is dismissed; browsers
    // that do not simply leave the promise pending until the next pick.
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

/** A clip's own pixel size, so its bubble is shaped before it loads. An
 * unreadable file just gets the default shape. */
function videoSize(url: string): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({});
      return;
    }
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () =>
      resolve({ width: probe.videoWidth || undefined, height: probe.videoHeight || undefined });
    probe.onerror = () => resolve({});
    probe.src = url;
  });
}

async function downscale(
  file: File,
  maxEdge: number,
): Promise<{ blob: Blob; width?: number; height?: number }> {
  const bitmap = await loadBitmap(file);
  const scale = scaleToFit(bitmap.width, bitmap.height, maxEdge);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: file };
  ctx.drawImage(bitmap, 0, 0, width, height);

  const encoded = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((out) => resolve(out), 'image/jpeg', 0.85),
  );
  // Falling back to the original keeps the pick working if the canvas refuses.
  return encoded ? { blob: encoded, width, height } : { blob: file };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari has historically refused some encodings here; fall through.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('That file is not an image we can read.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export { CHAT_IMAGE_MAX_EDGE };
