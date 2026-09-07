import * as ImagePicker from 'expo-image-picker';
import {
  assertImageSize,
  GALLERY_PICKER_OPTIONS,
  ImageSlot,
  PickedImage,
} from './pickedImage';

/** Native photo picking. The web build resolves `pickImage.web.ts` instead,
 * so `expo-image-picker` never reaches the browser bundle. */
export async function pickImage(slot: ImageSlot): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Macronaut needs access to your photos to change this image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // Cropping to the shape it will be shown in beats letterboxing a photo
    // into a square avatar or a wide banner.
    allowsEditing: slot !== 'post',
    aspect: slot === 'avatar' ? [1, 1] : slot === 'banner' ? [16, 9] : undefined,
    // The picker re-encodes at this quality, which is the native equivalent of
    // the canvas downscale the web build does.
    quality: 0.85,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return readAsset(asset);
}

/** Photo-wall picker: tap only selects, and the array stays in tap order. */
export async function pickImages(): Promise<PickedImage[] | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Macronaut needs access to your photos to add them to your wall.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    ...GALLERY_PICKER_OPTIONS,
  });
  if (result.canceled) return null;

  const picked: PickedImage[] = [];
  for (const asset of result.assets) {
    picked.push(await readAsset(asset));
  }
  return picked.length ? picked : null;
}

async function readAsset(asset: ImagePicker.ImagePickerAsset): Promise<PickedImage> {
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  assertImageSize(blob.size);
  return { blob, previewUri: asset.uri };
}
