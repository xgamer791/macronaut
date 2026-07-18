import React from 'react';
import { Platform, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Extra bottom padding so content clears the tab bar. */
  tabBarSpace?: boolean;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  tabBarSpace = false,
}: ScreenProps) {
  const { colors, resolved } = useTheme();
  const insets = useSafeAreaInsets();
  // Soft vignette behind dark glass so blur/frost reads as glass, not solid grey.
  const darkAtmosphere =
    resolved === 'dark' && Platform.OS === 'web'
      ? ({
          backgroundImage:
            'radial-gradient(120% 80% at 50% -10%, rgba(40, 52, 64, 0.55) 0%, transparent 55%), radial-gradient(90% 60% at 100% 100%, rgba(23, 166, 115, 0.08) 0%, transparent 45%)',
        } as object)
      : null;
  const base: StyleProp<ViewStyle> = [
    { flex: 1, backgroundColor: colors.background },
    { paddingTop: insets.top },
    darkAtmosphere,
  ];
  const contentPad = {
    padding: padded ? spacing.lg : 0,
    paddingBottom: (padded ? spacing.lg : 0) + (tabBarSpace ? 96 : insets.bottom),
    gap: spacing.lg,
  };

  if (!scroll) {
    return <View style={[base, contentPad, style]}>{children}</View>;
  }
  return (
    <View style={base}>
      <ScrollView
        contentContainerStyle={[contentPad, style]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}
