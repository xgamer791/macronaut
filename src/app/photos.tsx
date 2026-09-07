import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  AppText,
  Button,
  EmptyState,
  ListRow,
  Screen,
  ScreenHeader,
  Sheet,
} from '@/ui/components';
import type { ProfilePhoto } from '@/repositories/photoRepo';
import { pickImages } from '@/services/media/pickImage';
import {
  useAddPhotos,
  useDeletePhoto,
  useMyPhotos,
  usePublicPhotos,
  useSetPhotoPublic,
} from '@/state/queries';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

/**
 * Photo wall. Your own wall shows every photo you uploaded; someone else's
 * wall shows only the public ones, and only while their profile is public.
 */
export default function PhotosScreen() {
  return (
    <ThemeProvider initialMode="dark">
      <PhotoWall />
    </ThemeProvider>
  );
}

function PhotoWall() {
  const { handle } = useLocalSearchParams<{ handle?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const own = useMyPhotos();
  const other = usePublicPhotos(handle ?? '');
  const addPhotos = useAddPhotos();
  const setPublic = useSetPhotoPublic();
  const deletePhoto = useDeletePhoto();

  const [open, setOpen] = useState<ProfilePhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const isOwn = !handle;
  const wall = handle ? other.data : { isOwner: true, photos: own.data ?? [] };
  const loading = handle ? other.isLoading : own.isLoading;
  const photos = wall?.photos ?? [];
  const canEdit = isOwn || wall?.isOwner === true;
  const cell = Math.floor((width - spacing.lg * 2 - spacing.xs * 2) / 3);

  async function add() {
    setError(null);
    try {
      const picked = await pickImages();
      if (!picked?.length) return;
      setAdding(true);
      // Upload in tap order. Do not open a preview — select is the whole action.
      await addPhotos.mutateAsync({ files: picked.map((photo) => photo.blob), isPublic: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add those photos.');
    } finally {
      setAdding(false);
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
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={photo.caption || 'Photo'}
              onPress={() => setOpen(photo)}
              style={[styles.cell, { width: cell, height: cell, backgroundColor: colors.track }]}
            >
              {photo.imageUrl ? (
                <Image
                  source={{ uri: photo.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : null}
              {canEdit && !photo.isPublic ? (
                <View style={styles.lock}>
                  <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <Sheet visible={open !== null} onClose={() => setOpen(null)} title={open?.caption || 'Photo'}>
        {open?.imageUrl ? (
          <Image
            source={{ uri: open.imageUrl }}
            style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.track }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {canEdit && open ? (
          <>
            <ListRow
              title={open.isPublic ? 'Visible on your public wall' : 'Only you can see this'}
              subtitle={open.isPublic ? 'Make private' : 'Make public'}
              onPress={() => {
                const next = !open.isPublic;
                void setPublic.mutateAsync({ id: open.id, isPublic: next });
                setOpen({ ...open, isPublic: next });
              }}
            />
            <Button
              title="Delete photo"
              variant="danger"
              onPress={() => {
                void deletePhoto.mutateAsync(open.id);
                setOpen(null);
              }}
            />
          </>
        ) : null}
      </Sheet>
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
