import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { AppText, EmptyState, PhotoViewer, Screen, ScreenHeader } from '@/ui/components';
import { pickImages } from '@/services/media/pickImage';
import { useAuth } from '@/state/AuthProvider';
import {
  useAddPhotoComment,
  useAddPhotos,
  useDeletePhoto,
  useMyPhotos,
  useMyProfile,
  usePhotoThread,
  usePublicPhotos,
  useRemovePhotoComment,
  useSetPhotoLike,
  useSetPhotoPublic,
} from '@/state/queries';
import { photoShareUrl } from '@/utils/publicLinks';
import { SlideScreen } from '@/ui/motion/SlideScreen';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

/**
 * Photo wall. Your own wall shows every photo you uploaded; someone else's
 * wall shows only the public ones, and only while their profile is public.
 */
export default function PhotosScreen() {
  return (
    <ThemeProvider initialMode="dark">
      <SlideScreen from="left">
        <PhotoWall />
      </SlideScreen>
    </ThemeProvider>
  );
}

function PhotoWall() {
  const { handle, photo: deepPhoto } = useLocalSearchParams<{ handle?: string; photo?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { signedIn } = useAuth();
  const me = useMyProfile();
  const own = useMyPhotos();
  const other = usePublicPhotos(handle ?? '');
  const addPhotos = useAddPhotos();
  const setPublic = useSetPhotoPublic();
  const deletePhoto = useDeletePhoto();
  const setLike = useSetPhotoLike();
  const addComment = useAddPhotoComment();
  const removeComment = useRemovePhotoComment();

  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [shared, setShared] = useState(false);

  const isOwn = !handle;
  const wall = handle ? other.data : { isOwner: true, photos: own.data ?? [] };
  const loading = handle ? other.isLoading : own.isLoading;
  const photos = wall?.photos ?? [];
  const canEdit = isOwn || wall?.isOwner === true;
  const cell = Math.floor((width - spacing.lg * 2 - spacing.xs * 2) / 3);
  const deepId = Array.isArray(deepPhoto) ? deepPhoto[0] : deepPhoto;
  const activeId = openId === '' ? undefined : (openId ?? deepId);
  const open = photos.find((row) => row.id === activeId) ?? null;
  const thread = usePhotoThread(open?.id ?? '');
  const shareHandle = handle || thread.data?.ownerHandle || me.data?.handle || '';

  async function add() {
    setError(null);
    try {
      const picked = await pickImages();
      if (!picked?.length) return;
      setAdding(true);
      // Upload in tap order. Do not open a preview — select is the whole action.
      await addPhotos.mutateAsync({ files: picked.map((row) => row.blob), isPublic: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add those photos.');
    } finally {
      setAdding(false);
    }
  }

  async function sharePhoto() {
    if (!open) return;
    const url = photoShareUrl(shareHandle || undefined, open.id);
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
      setError(`Could not share automatically. The link is ${url}`);
    }
  }

  if (handle && !other.isLoading && other.data === null) {
    return (
      <Screen>
        <ScreenHeader title="Photos" />
        <EmptyState
          title="Photos not available"
          body="This profile is private, or the link is wrong."
          actionTitle="Back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeTop>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader
          title="Photos"
          right={
            canEdit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add photos"
                onPress={() => void add()}
                hitSlop={8}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                {adding ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Ionicons name="add" size={28} color={colors.textPrimary} />
                )}
              </Pressable>
            ) : null
          }
        />
      </View>

      {error ? (
        <AppText variant="caption" tone="danger" style={{ paddingHorizontal: spacing.lg }}>
          {error}
        </AppText>
      ) : null}
      {shared ? (
        <AppText variant="caption" style={{ paddingHorizontal: spacing.lg }}>
          Link copied.
        </AppText>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : photos.length === 0 ? (
        <EmptyState
          title={canEdit ? 'Nothing on the wall yet' : 'No public photos'}
          body={
            canEdit
              ? 'Add photos to your wall. Public ones show on your profile for anyone you share it with.'
              : 'They have not published any photos yet.'
          }
          actionTitle={canEdit ? 'Add a photo' : undefined}
          onAction={canEdit ? () => void add() : undefined}
        />
      ) : (
        <View style={styles.grid}>
          {photos.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={row.caption || 'Photo'}
              onPress={() => setOpenId(row.id)}
              style={[styles.cell, { width: cell, height: cell, backgroundColor: colors.track }]}
            >
              {row.imageUrl ? (
                <Image
                  source={{ uri: row.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : null}
              {canEdit && !row.isPublic ? (
                <View style={styles.lock}>
                  <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <PhotoViewer
        photo={open}
        thread={thread.data}
        canEdit={canEdit}
        signedIn={signedIn}
        onClose={() => setOpenId('')}
        onLike={(liked) => {
          if (!open) return;
          void setLike.mutateAsync({ id: open.id, liked });
        }}
        onComment={async (body) => {
          if (!open) return;
          await addComment.mutateAsync({ id: open.id, body });
        }}
        onDeleteComment={(id) => {
          if (!open) return;
          void removeComment.mutateAsync({ photoId: open.id, id });
        }}
        onShare={() => void sharePhoto()}
        onTogglePublic={() => {
          if (!open) return;
          void setPublic.mutateAsync({ id: open.id, isPublic: !open.isPublic });
        }}
        onDelete={() => {
          if (!open) return;
          void deletePhoto.mutateAsync(open.id);
          setOpenId('');
        }}
        onNeedSignIn={() => setError('Sign in to like and comment on photos.')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  cell: {
    overflow: 'hidden',
  },
  lock: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(6,9,12,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
