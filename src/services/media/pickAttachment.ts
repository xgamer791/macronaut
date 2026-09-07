import * as ImagePicker from 'expo-image-picker';
import {
  assertAttachmentSize,
  attachmentKind,
  CHAT_IMAGE_MAX_EDGE,
  PickedAttachment,
} from './pickedAttachment';

/**
 * Native picker for one chat attachment — a photo or a clip. The web build
 * resolves `pickAttachment.web.ts` instead, so `expo-image-picker` never
 * reaches the browser bundle.
 */
export async function pickAttachment(): Promise<PickedAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Macronaut needs access to your photos to send them in a chat.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsEditing: false,
    // The picker re-encodes a photo at this quality; a clip is untouched.
    quality: 0.85,
    videoMaxDuration: 180,
  });
  return pickedAsset(result);
}

/** Open the device camera and return a photo in the same shape as a library pick. */
export async function takePhotoAttachment(): Promise<PickedAttachment | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Macronaut needs camera access to take a photo for this chat.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
  });
  return pickedAsset(result);
}

async function pickedAsset(
  result: ImagePicker.ImagePickerResult,
): Promise<PickedAttachment | null> {
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  const kind = asset.type === 'video' ? 'video' : attachmentKind(asset.mimeType);
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  assertAttachmentSize(kind, blob.size);
  return {
    kind,
    blob,
    previewUri: asset.uri,
    width: asset.width || undefined,
    height: asset.height || undefined,
  };
}

export { CHAT_IMAGE_MAX_EDGE };
