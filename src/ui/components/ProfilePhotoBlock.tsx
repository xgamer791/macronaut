import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ProfilePhoto } from '@/repositories/photoRepo';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { Button } from './Button';
import { SectionHeader } from './SectionHeader';

const PHOTO_PREVIEW_LIMIT = 6;
const MAX_CONTENT_WIDTH = 720;

export function ProfilePhotoBlock({
  photos,
  loading = false,
  canSeePrivate = false,
  onOpenPhoto,
  onSeeAll,
}: {
  photos: ProfilePhoto[];
  loading?: boolean;
  canSeePrivate?: boolean;
  onOpenPhoto: (photo: ProfilePhoto) => void;
  onSeeAll: () => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - spacing.lg * 2, MAX_CONTENT_WIDTH);
  const cell = Math.floor((contentWidth - spacing.xs * 2) / 3);
  const preview = photos.slice(0, PHOTO_PREVIEW_LIMIT);

  if (!loading && preview.length === 0) return null;

  return (
    <View style={[styles.block, { maxWidth: MAX_CONTENT_WIDTH }]}>
      <SectionHeader title="Photos" />
      {loading ? (
        <View style={[styles.loading, { backgroundColor: colors.surface }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {preview.map((photo) => (
              <Pressable
                key={photo.id}
                accessibilityRole="button"
                accessibilityLabel={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
                onPress={() => onOpenPhoto(photo)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    width: cell,
                    height: cell,
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                {photo.imageUrl ? (
                  <Image
                    source={{ uri: photo.imageUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={180}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                )}
                {canSeePrivate && !photo.isPublic ? (
                  <View style={styles.privateBadge}>
                    <Ionicons
                      name="lock-closed"
                      size={12}
                      color="#FFFFFF"
                      style={styles.badgeGlyph}
                    />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
          <Button
            title="See all photos"
            variant="secondary"
            onPress={onSeeAll}
            accessibilityHint="Opens the full photo gallery"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md,
  },
  loading: {
    height: 132,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  cell: {
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  privateBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // No disc behind the glyph, so it carries its own shadow over the photo.
  badgeGlyph: {
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
