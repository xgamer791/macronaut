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
  /** Set through the gyms repo, never through `update`. */
  homeGym?: { id: string; name: string; address: string };
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
  /** Whether this page follows the viewer back. The two together are the
   * mutual follow that makes a friend, and friends may message each other. */
  isFollowedBy: boolean;
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
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
}

export interface ProfilePostComment {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorHandle?: string;
  isMine: boolean;
}

export interface ProfilePostThread {
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  comments: ProfilePostComment[];
}

export interface FriendsFeedPost extends ProfilePost {
  author: {
    id: string;
    handle: string;
    displayName?: string;
    avatarUrl?: string;
    canOpenProfile: boolean;
  };
}

export interface FriendsFeedPage {
  page: FriendsFeedPost[];
  isDone: boolean;
  continueCursor: string;
}

export type ConnectionTab = 'followers' | 'following' | 'friends';

/** One person in a followers / following / friends list. The identity card
 * and nothing else: where the viewer stands with them decides which single
 * action the row offers, exactly as it does in people search. */
export interface ConnectionPerson {
  /** The account, which is what every friend and chat action addresses. */
  id: string;
  /** Null until the account has claimed a profile; the name still shows. */
  handle: string | null;
  displayName: string;
  avatarUrl?: string;
  friendship: 'none' | 'outgoing' | 'incoming' | 'friends';
  /** The viewer's own row, which offers no action against itself. */
  isYou: boolean;
}

export interface ConnectionsView {
  /** Whose lists these are — the page title above the tabs. */
  subject: { handle: string; displayName: string };
  /** All three, on every read, so the tabs are labelled without three trips. */
  counts: { followers: number; following: number; friends: number };
  people: ConnectionPerson[];
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
  /** Claim this account's profile row and handle if it has none yet, so the
   * account is findable by everyone else's search. Safe to call repeatedly. */
  ensure(): Promise<{ handle: string }>;
  /** The signed-in user's own profile. */
  me(): Promise<ProfileView>;
  myPosts(): Promise<ProfilePost[]>;
  friendsFeed(cursor: string | null): Promise<FriendsFeedPage>;
  /** A profile by handle. Null when it does not exist or is not public and
   * is not yours — the caller cannot tell those apart, by design. */
  byHandle(handle: string): Promise<{ profile: ProfileView; posts: ProfilePost[] } | null>;
  update(patch: ProfilePatch): Promise<ProfileView>;
  /** Store an image and return its storage id, for `setImage` or `addPost`. */
  uploadImage(file: Blob): Promise<string>;
  setImage(kind: ProfileImageKind, storageId: string | null): Promise<ProfileView>;
  addPost(body: string, imageId?: string): Promise<ProfilePost>;
  updatePost(id: string, body: string): Promise<ProfilePost>;
  postThread(id: string): Promise<ProfilePostThread | null>;
  setPostLike(id: string, liked: boolean): Promise<ProfilePost>;
  addPostComment(id: string, body: string): Promise<ProfilePostComment>;
  removePostComment(id: string): Promise<void>;
  removePost(id: string): Promise<void>;
  /** Follow or unfollow the profile at a handle. Returns that profile as it
   * looks afterwards, so the counts on the page update from the same round trip. */
  setFollow(handle: string, follow: boolean): Promise<ProfileView>;
  /** The same friend request, addressed to an account by id — how a people
   * search result is befriended, since it may have no handle yet. */
  requestFriend(userId: string, follow: boolean): Promise<ProfileView>;
  /** One tab of the people around a profile. No handle means your own. Null
   * when the page is private or the handle is nobody's — the caller cannot
   * tell those apart, as with `byHandle`. Searching is answered by the server
   * so it looks at the whole list rather than the page that arrived. */
  connections(input: {
    handle?: string;
    tab: ConnectionTab;
    search?: string;
  }): Promise<ConnectionsView | null>;
}

const postId = (id: string) => id as Id<'profilePosts'>;
const postCommentId = (id: string) => id as Id<'profilePostComments'>;
const fileId = (id: string) => id as Id<'_storage'>;

export function createProfileRepo(convex: ConvexCaller): ProfileRepo {
  return {
    ensure: () => convex.mutation(api.profiles.ensure, {}),
    me: () => convex.query(api.profiles.me, {}),
    myPosts: () => convex.query(api.profiles.myPosts, {}),
    friendsFeed: (cursor) => convex.query(api.profiles.friendsFeed, { cursor }),
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
      convex.mutation(
        api.profiles.addPost,
        clean({ body, imageId: imageId ? fileId(imageId) : undefined }),
      ),
    updatePost: (id, body) => convex.mutation(api.profiles.updatePost, { id: postId(id), body }),
    postThread: (id) => convex.query(api.profiles.postThread, { id: postId(id) }),
    setPostLike: (id, liked) =>
      convex.mutation(api.profiles.setPostLike, { id: postId(id), liked }),
    addPostComment: (id, body) =>
      convex.mutation(api.profiles.addPostComment, { id: postId(id), body }),
    async removePostComment(id) {
      await convex.mutation(api.profiles.removePostComment, { id: postCommentId(id) });
    },
    async removePost(id) {
      await convex.mutation(api.profiles.removePost, { id: postId(id) });
    },
    setFollow: (handle, follow) => convex.mutation(api.profiles.setFollow, { handle, follow }),
    requestFriend: (userId, follow) =>
      convex.mutation(api.profiles.setFollow, { userId: userId as Id<'users'>, follow }),

    connections: ({ handle, tab, search }) =>
      convex.query(api.profiles.connections, clean({ handle, tab, search })),
  };
}
