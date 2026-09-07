import { assertImageSize, IMAGE_MAX_EDGE, ImageSlot, PickedImage, scaleToFit } from './pickedImage';

/**
 * Web photo picking. A hidden `<input type="file">` rather than
 * `expo-image-picker`, for the same reason the AI food scan uses one: it is
 * the browser's own file dialog, needs no permission prompt, and keeps the
 * native module out of the bundle.
 *
 * The file is redrawn through a canvas before upload, so a phone camera photo
 * arrives as a few hundred kilobytes instead of several megabytes.
 */
export async function pickImage(slot: ImageSlot): Promise<PickedImage | null> {
  const file = await chooseFile();
  if (!file) return null;
  const blob = await downscale(file, IMAGE_MAX_EDGE[slot]);
  assertImageSize(blob.size);
  return { blob, previewUri: URL.createObjectURL(blob) };
}

function chooseFile(): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    // Firefox needs the input in the document for `click()` to open a dialog.
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    // Chrome and Safari fire `cancel` when the dialog is dismissed; browsers
    // that do not simply leave the promise pending until the next pick, which
    // is why nothing is awaited on a cancel path.
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

async function downscale(file: File, maxEdge: number): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const scale = scaleToFit(bitmap.width, bitmap.height, maxEdge);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const encoded = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((out) => resolve(out), 'image/jpeg', 0.85),
  );
  // A transparent PNG re-encoded as JPEG loses its transparency, but every
  // slot here is drawn on an opaque surface. Falling back to the original
  // keeps the pick working if the canvas refuses.
  return encoded ?? file;
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
