import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ChatPerson } from '@/repositories/chatRepo';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { AppText } from './AppText';

export function ChatAvatar({ person, size = 54 }: { person: ChatPerson; size?: number }) {
  const { colors } = useTheme();
  const initials = person.displayName
    .replace(/^@/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceRaised,
        },
      ]}
    >
      {person.avatarUrl ? (
        <Image
          source={{ uri: person.avatarUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <AppText weight="700" style={{ fontSize: Math.max(13, size * 0.33) }}>
          {initials || '?'}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
