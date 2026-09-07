import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {
  AppText,
  Button,
  Card,
  CircleButton,
  ErrorState,
  ListRow,
  ProfileHeader,
  ProfilePostList,
  Screen,
  SectionHeader,
  Sheet,
  TextField,
} from '@/ui/components';
import type { ProfilePost, ProfileView } from '@/repositories/profileRepo';
import { pickImage } from '@/services/media/pickImage';
import {
  useAddProfilePost,
  useDeleteProfilePost,
  useMyProfile,
  useMyProfilePosts,
  useSetProfileImage,
  useUpdateProfile,
  useUpdateProfilePost,
} from '@/state/queries';
import { goBackOrHome } from '@/utils/navigation';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import type { PickedImage } from '@/services/media/pickedImage';

/** Public URL of a profile. Matches the `/u/[handle]` route. */
export function profileUrl(handle: string): string {
  const base =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}`
      : 'https://xgamer791.github.io/macronaut';
  return `${base}/u/${handle}`;
}

/**
 * Your own profile page — opened from the header avatar.
 *
 * Always dark regardless of the app's appearance setting: it is a photo-led
 * page, and the banner and picture are chosen against a dark frame. Nesting a
 * ThemeProvider is how that is forced, so every themed child below still uses
 * the ordinary tokens rather than hardcoded hexes.
 */
export default function ProfileScreen() {
  return (
    <ThemeProvider initialMode="dark">
      <OwnProfile />
    </ThemeProvider>
  );
}

function OwnProfile() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useMyProfile();
  const posts = useMyProfilePosts();

  const setImage = useSetProfileImage();
  const updateProfile = useUpdateProfile();
  const addPost = useAddProfilePost();
  const updatePost = useUpdateProfilePost();
  const deletePost = useDeleteProfilePost();

  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [managed, setManaged] = useState<ProfilePost | null>(null);
  const [editingPost, setEditingPost] = useState<ProfilePost | null>(null);
  const [shared, setShared] = useState(false);

  if (profile.isError) {
    return (
      <Screen>
        <ErrorState message="Could not load your profile." onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }

  const data = profile.data;

  async function replaceImage(kind: 'avatar' | 'banner') {
    setError(null);
    try {
      const picked = await pickImage(kind);
      if (!picked) return;
      setUploading(kind);
      await setImage.mutateAsync({ kind, file: picked.blob });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change that image.');
    } finally {
      setUploading(null);
    }
  }

  async function togglePublic() {
    if (!data) return;
    setError(null);
    void Haptics.selectionAsync();
    try {
      await updateProfile.mutateAsync({ isPublic: !data.isPublic });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change who can see your profile.');
    }
  }

  /** The share sheet on a phone; on the web the browser's own share dialog
   * when it has one, and the clipboard when it does not. */
  async function share() {
    if (!data) return;
    const url = profileUrl(data.handle);
    try {
      if (Platform.OS !== 'web') {
        await Share.share({ message: url, url });
        return;
      }
      const nav = typeof navigator === 'undefined' ? undefined : navigator;
      if (nav?.share) {
        await nav.share({ url });
        return;
      }
      if (!nav?.clipboard) throw new Error('no clipboard');
      await nav.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      setError(`Could not share automatically. Your link is ${url}`);
    }
  }

  return (
    <Screen padded={false} safeTop={false} scroll>
      {data ? (
        <>
          <ProfileHeader
            profile={data}
            onBack={() => goBackOrHome(router)}
            right={
              <CircleButton
                icon="settings-sharp"
                label="Open settings"
                onPress={() => router.push('/settings')}
              />
            }
            onPickAvatar={() => void replaceImage('avatar')}
            onPickBanner={() => void replaceImage('banner')}
            uploading={uploading}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.actions}
          >
            <Action
              icon="pencil"
              label="Edit profile"
              onPress={() => {
                void Haptics.selectionAsync();
                setEditOpen(true);
              }}
            />
            <Action
              icon="person-circle-outline"
              label="Photo"
              onPress={() => void replaceImage('avatar')}
            />
            <Action icon="image-outline" label="Banner" onPress={() => void replaceImage('banner')} />
            <Action
              icon={data.isPublic ? 'globe-outline' : 'lock-closed-outline'}
              label={data.isPublic ? 'Public' : 'Private'}
              active={data.isPublic}
              busy={updateProfile.isPending}
              onPress={() => void togglePublic()}
            />
            <Action
              icon={shared ? 'checkmark' : 'share-outline'}
              label={shared ? 'Copied' : 'Share'}
              onPress={() => void share()}
            />
          </ScrollView>

          {error ? (
            <View style={styles.body}>
              <Card style={{ borderColor: colors.danger }}>
                <AppText variant="caption" tone="danger">
                  {error}
                </AppText>
              </Card>
            </View>
          ) : null}

          <View style={styles.body}>
            <VisibilityCard profile={data} onToggle={() => void togglePublic()} />

            <SectionHeader
              title="Posts"
              right={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Write a post"
                  onPress={() => setComposeOpen(true)}
                  style={styles.sectionAction}
                >
                  <AppText variant="caption" weight="600" tone="accent">
                    New post
                  </AppText>
                </Pressable>
              }
            />

            <Composer profile={data} onPress={() => setComposeOpen(true)} />

            {posts.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <ProfilePostList
                posts={posts.data ?? []}
                onManage={setManaged}
                emptyTitle="Nothing posted yet"
                emptyBody="Share a session, a personal best or a meal you are proud of. Posts show on your profile page."
              />
            )}
          </View>
        </>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      <EditProfileSheet
        visible={editOpen}
        profile={data}
        onClose={() => setEditOpen(false)}
        onSave={async (patch) => {
          await updateProfile.mutateAsync(patch);
          setEditOpen(false);
        }}
      />

      <ComposeSheet
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        onPost={async (body, picked) => {
          await addPost.mutateAsync({ body, file: picked?.blob ?? null });
          setComposeOpen(false);
        }}
      />

      <Sheet visible={managed !== null} onClose={() => setManaged(null)} title="Post">
        <ListRow
          title="Edit post"
          onPress={() => {
            setEditingPost(managed);
            setManaged(null);
          }}
        />
        <ListRow
          title="Delete post"
          destructive
          onPress={() => {
            const target = managed;
            setManaged(null);
            if (target) void deletePost.mutateAsync(target.id);
          }}
        />
      </Sheet>

      <EditPostSheet
        post={editingPost}
        onClose={() => setEditingPost(null)}
        onSave={async (body) => {
          if (editingPost) await updatePost.mutateAsync({ id: editingPost.id, body });
          setEditingPost(null);
        }}
      />
    </Screen>
  );
}

/** Spells out what the public toggle actually does, and shows the link it
 * produces once the profile is public. */
function VisibilityCard({ profile, onToggle }: { profile: ProfileView; onToggle: () => void }) {
  return (
    <Card style={{ gap: spacing.sm }}>
      <AppText variant="body" weight="600">
        {profile.isPublic ? 'Your profile is public' : 'Your profile is private'}
      </AppText>
      <AppText variant="caption" tone="secondary">
        {profile.isPublic
          ? 'Anyone with your link can see your picture, bio and posts. Your diary, goals and weight stay private either way.'
          : 'Only you can see this page. Make it public to share your link with training partners.'}
      </AppText>
      {profile.isPublic ? (
        <AppText variant="caption" tone="accent" weight="600" selectable>
          {profileUrl(profile.handle)}
        </AppText>
      ) : null}
      <Button
        title={profile.isPublic ? 'Make private' : 'Make public'}
        variant="secondary"
        compact
        onPress={onToggle}
      />
    </Card>
  );
}

function Composer({ profile, onPress }: { profile: ProfileView; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Post something"
      onPress={onPress}
      style={({ pressed }) => [
        styles.composer,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.composerAvatar, { backgroundColor: colors.surfaceRaised }]}>
        {profile.avatarUrl ? (
          <Image
            source={{ uri: profile.avatarUrl }}
            style={styles.composerAvatarImg}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Ionicons name="person" size={16} color={colors.textMuted} />
        )}
      </View>
      <AppText variant="body" tone="muted" style={{ flex: 1 }}>
        Post something…
      </AppText>
      <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function Action({
  icon,
  label,
  onPress,
  active,
  busy,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[
          styles.actionCircle,
          {
            backgroundColor: active ? colors.accent : colors.surfaceRaised,
            borderColor: active ? colors.accent : colors.border,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={active ? colors.onAccent : colors.textPrimary} />
        ) : (
          <Ionicons name={icon} size={22} color={active ? colors.onAccent : colors.textPrimary} />
        )}
      </View>
      <AppText variant="micro" weight="600" align="center" numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

function EditProfileSheet({
  visible,
  profile,
  onClose,
  onSave,
}: {
  visible: boolean;
  profile?: ProfileView;
  onClose: () => void;
  onSave: (patch: ProfileDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form from the profile the first time the sheet opens, and reset
  // it whenever it closes, so a cancelled edit does not linger.
  const seeded = draft !== null;
  if (visible && !seeded && profile) {
    setDraft({
      displayName: profile.displayName ?? '',
      handle: profile.handle,
      bio: profile.bio ?? '',
      location: profile.location ?? '',
      primarySport: profile.primarySport ?? '',
    });
  }
  if (!visible && seeded) setDraft(null);

  return (
    <Sheet visible={visible && draft !== null} onClose={onClose} title="Edit profile">
      {draft === null ? null : (
        <EditProfileFields
          draft={draft}
          setDraft={setDraft}
          error={error}
          saving={saving}
          onSubmit={async () => {
            setSaving(true);
            setError(null);
            try {
              await onSave(draft);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not save your profile.');
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </Sheet>
  );
}

interface ProfileDraft {
  displayName: string;
  handle: string;
  bio: string;
  location: string;
  primarySport: string;
}

function EditProfileFields({
  draft,
  setDraft,
  error,
  saving,
  onSubmit,
}: {
  draft: ProfileDraft;
  setDraft: (next: ProfileDraft) => void;
  error: string | null;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      <TextField
        label="Name"
        value={draft.displayName}
        onChangeText={(displayName) => setDraft({ ...draft, displayName })}
        placeholder="Your name"
        maxLength={60}
      />
      <TextField
        label="Handle"
        value={draft.handle}
        onChangeText={(handle) => setDraft({ ...draft, handle })}
        placeholder="yourname"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={24}
        error={error ?? undefined}
      />
      <AppText variant="micro" tone="muted">
        Letters, numbers and underscores. This is the link people open: /u/{draft.handle || '…'}
      </AppText>
      <TextField
        label="Bio"
        value={draft.bio}
        onChangeText={(bio) => setDraft({ ...draft, bio })}
        placeholder="Marathon training, mostly early mornings."
        multiline
        maxLength={280}
        style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.sm }}
      />
      <TextField
        label="Main sport"
        value={draft.primarySport}
        onChangeText={(primarySport) => setDraft({ ...draft, primarySport })}
        placeholder="Running"
        maxLength={40}
      />
      <TextField
        label="Location"
        value={draft.location}
        onChangeText={(location) => setDraft({ ...draft, location })}
        placeholder="San Luis Obispo"
        maxLength={60}
      />
      <Button title="Save profile" loading={saving} onPress={onSubmit} />
    </>
  );
}

function ComposeSheet({
  visible,
  onClose,
  onPost,
}: {
  visible: boolean;
  onClose: () => void;
  onPost: (body: string, picked: PickedImage | null) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setBody('');
    setPicked(null);
    setError(null);
  }

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New post"
    >
      <TextField
        label="What do you want to say?"
        value={body}
        onChangeText={setBody}
        placeholder="Ran the long loop before work and finally felt easy."
        multiline
        maxLength={1000}
        style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: spacing.sm }}
      />
      <Button
        title={picked ? 'Photo attached — change' : 'Add a photo'}
        variant="secondary"
        onPress={async () => {
          setError(null);
          try {
            const next = await pickImage('post');
            if (next) setPicked(next);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not attach that photo.');
          }
        }}
      />
      {picked ? (
        <Button title="Remove photo" variant="ghost" compact onPress={() => setPicked(null)} />
      ) : null}
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button
        title="Post"
        loading={posting}
        disabled={!body.trim() && !picked}
        onPress={async () => {
          setPosting(true);
          setError(null);
          try {
            await onPost(body, picked);
            reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not post that.');
          } finally {
            setPosting(false);
          }
        }}
      />
      <AppText variant="micro" tone="muted" style={{ color: colors.textMuted }}>
        Posts are only visible to you until you make your profile public.
      </AppText>
    </Sheet>
  );
}

function EditPostSheet({
  post,
  onClose,
  onSave,
}: {
  post: ProfilePost | null;
  onClose: () => void;
  onSave: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [seededId, setSeededId] = useState<string | null>(null);

  if (post && seededId !== post.id) {
    setSeededId(post.id);
    setBody(post.body);
  }
  if (!post && seededId !== null) setSeededId(null);

  return (
    <Sheet visible={post !== null} onClose={onClose} title="Edit post">
      <TextField
        label="Post"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={1000}
        style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: spacing.sm }}
      />
      <Button
        title="Save"
        loading={saving}
        disabled={!body.trim() && !post?.imageUrl}
        onPress={async () => {
          setSaving(true);
          try {
            await onSave(body);
          } finally {
            setSaving(false);
          }
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.xxl * 2,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  action: {
    width: 68,
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  sectionAction: {
    minHeight: touchTarget,
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touchTarget + spacing.sm,
  },
  composerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAvatarImg: {
    width: '100%',
    height: '100%',
  },
});
