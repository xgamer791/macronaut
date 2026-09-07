import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { clean, ConvexCaller } from './convexCall';

export interface ProfilePhoto {
  id: string;
  imageUrl?: string;
  caption?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoWall {
  isOwner: boolean;
  photos: ProfilePhoto[];
}

export interface PhotoRepo {
  mine(): Promise<ProfilePhoto[]>;
  forHandle(handle: string): Promise<PhotoWall | null>;
  upload(file: Blob): Promise<string>;
  add(imageId: string, caption?: string, isPublic?: boolean): Promise<ProfilePhoto>;
  setPublic(id: string, isPublic: boolean): Promise<ProfilePhoto>;
  remove(id: string): Promise<void>;
}

const photoId = (id: string) => id as Id<'profilePhotos'>;
const fileId = (id: string) => id as Id<'_storage'>;

export function createPhotoRepo(convex: ConvexCaller): PhotoRepo {
  return {
    mine: () => convex.query(api.photos.mine, {}),
    forHandle: (handle) => convex.query(api.photos.forHandle, { handle }),
    async upload(file) {
      const uploadUrl = await convex.mutation(api.profiles.generateUploadUrl, {});
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: file.type ? { 'Content-Type': file.type } : undefined,
        body: file,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const { storageId } = (await response.json()) as { storageId: string };
      if (!storageId) throw new Error('Upload did not return a file id');
      return storageId;
    },
    add: (imageId, caption, isPublic) =>
      convex.mutation(api.photos.add, clean({ imageId: fileId(imageId), caption, isPublic })),
    setPublic: (id, isPublic) => convex.mutation(api.photos.setPublic, { id: photoId(id), isPublic }),
    async remove(id) {
      await convex.mutation(api.photos.remove, { id: photoId(id) });
    },
  };
}
