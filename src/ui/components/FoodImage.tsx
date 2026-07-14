import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius } from '@/ui/theme/tokens';

/** Food thumbnail with a polished fallback — never a broken-image glyph. */
export function FoodImage({ uri, size = 44 }: { uri?: string; size?: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius.sm,
          backgroundColor: colors.track,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessible={false}
      >
        <Ionicons name="restaurant-outline" size={size * 0.45} color={colors.textMuted} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: colors.track }}
      contentFit="cover"
      accessible={false}
    />
  );
}
