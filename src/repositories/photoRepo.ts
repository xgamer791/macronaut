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

export interface PhotoComment {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorHandle?: string;
  isMine: boolean;
}

export interface PhotoThread {
  photo: ProfilePhoto;
  ownerName: string;
  ownerHandle: string;
  likeCount: number;
  likedByMe: boolean;
  comments: PhotoComment[];
}

export interface PhotoRepo {
  mine(): Promise<ProfilePhoto[]>;
  forHandle(handle: string): Promise<PhotoWall | null>;
  thread(id: string): Promise<PhotoThread | null>;
  upload(file: Blob): Promise<string>;
  add(imageId: string, caption?: string, isPublic?: boolean): Promise<ProfilePhoto>;
  addMany(imageIds: string[], isPublic?: boolean): Promise<ProfilePhoto[]>;
  setPublic(id: string, isPublic: boolean): Promise<ProfilePhoto>;
  setLike(id: string, liked: boolean): Promise<PhotoThread>;
  addComment(id: string, body: string): Promise<PhotoComment>;
  removeComment(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

const photoId = (id: string) => id as Id<'profilePhotos'>;
const commentId = (id: string) => id as Id<'photoComments'>;
const fileId = (id: string) => id as Id<'_storage'>;

export function createPhotoRepo(convex: ConvexCaller): PhotoRepo {
  return {
    mine: () => convex.query(api.photos.mine, {}),
    forHandle: (handle) => convex.query(api.photos.forHandle, { handle }),
    thread: (id) => convex.query(api.photos.thread, { id: photoId(id) }),
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
    addMany: (imageIds, isPublic) =>
      convex.mutation(api.photos.addMany, clean({ imageIds: imageIds.map(fileId), isPublic })),
    setPublic: (id, isPublic) => convex.mutation(api.photos.setPublic, { id: photoId(id), isPublic }),
    setLike: (id, liked) => convex.mutation(api.photos.setLike, { id: photoId(id), liked }),
    addComment: (id, body) => convex.mutation(api.photos.addComment, { id: photoId(id), body }),
    async removeComment(id) {
      await convex.mutation(api.photos.removeComment, { id: commentId(id) });
    },
    async remove(id) {
      await convex.mutation(api.photos.remove, { id: photoId(id) });
    },
  };
}
