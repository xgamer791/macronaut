import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { clean, ConvexCaller } from './convexCall';

/** A profile page as the server hands it over: storage ids already resolved
 * to URLs, ownership dropped. The same shape for your own page and for
 * someone else's public one — `isOwner` is what differs. */
export interface ProfileView {
  /** Null until the first save; the rest of the shape is still filled in. */
  id: string | null;
  handle: string;
  displayName?: string;
  bio?: string;
  location?: string;
  primarySport?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  /** Whether the signed-in viewer follows this page. Always false on yours. */
  isFollowing: boolean;
  isOwner: boolean;
  /** False while the profile is still the placeholder built from the account. */
  saved: boolean;
}

export interface ProfilePost {
  id: string;
  body: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfilePatch {
  displayName?: string;
  bio?: string;
  location?: string;
  primarySport?: string;
  handle?: string;
  isPublic?: boolean;
}

export type ProfileImageKind = 'avatar' | 'banner';

export interface ProfileRepo {
  /** The signed-in user's own profile. */
  me(): Promise<ProfileView>;
  myPosts(): Promise<ProfilePost[]>;
  /** A profile by handle. Null when it does not exist or is not public and
   * is not yours — the caller cannot tell those apart, by design. */
  byHandle(handle: string): Promise<{ profile: ProfileView; posts: ProfilePost[] } | null>;
  update(patch: ProfilePatch): Promise<ProfileView>;
  /** Store an image and return its storage id, for `setImage` or `addPost`. */
  uploadImage(file: Blob): Promise<string>;
  setImage(kind: ProfileImageKind, storageId: string | null): Promise<ProfileView>;
  addPost(body: string, imageId?: string): Promise<ProfilePost>;
  updatePost(id: string, body: string): Promise<ProfilePost>;
  removePost(id: string): Promise<void>;
  /** Follow or unfollow a public profile. Returns that profile as it looks
   * afterwards, so the counts on the page update from the same round trip. */
  setFollow(handle: string, follow: boolean): Promise<ProfileView>;
}

const postId = (id: string) => id as Id<'profilePosts'>;
const fileId = (id: string) => id as Id<'_storage'>;

export function createProfileRepo(convex: ConvexCaller): ProfileRepo {
  return {
    me: () => convex.query(api.profiles.me, {}),
    myPosts: () => convex.query(api.profiles.myPosts, {}),
    byHandle: (handle) => convex.query(api.profiles.byHandle, { handle }),
    update: (patch) => convex.mutation(api.profiles.update, clean(patch)),

    /** Uploads go straight to Convex storage rather than through a mutation
     * argument, which is capped well below a photo. */
    async uploadImage(file) {
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

    setImage: (kind, storageId) =>
      convex.mutation(api.profiles.setImage, {
        kind,
        storageId: storageId === null ? null : fileId(storageId),
      }),

    addPost: (body, imageId) =>
      convex.mutation(api.profiles.addPost, clean({ body, imageId: imageId ? fileId(imageId) : undefined })),
    updatePost: (id, body) => convex.mutation(api.profiles.updatePost, { id: postId(id), body }),
    async removePost(id) {
      await convex.mutation(api.profiles.removePost, { id: postId(id) });
    },
    setFollow: (handle, follow) => convex.mutation(api.profiles.setFollow, { handle, follow }),
  };
}
