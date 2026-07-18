import React from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';
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
  /** When false, content can draw under the status bar (full-bleed heroes). */
  safeTop?: boolean;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  tabBarSpace = false,
  safeTop = true,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const base: StyleProp<ViewStyle> = [
    { flex: 1, backgroundColor: colors.background },
    { paddingTop: safeTop ? insets.top : 0 },
  ];
  const contentPad = {
    padding: padded ? spacing.lg : 0,
    paddingBottom: (padded ? spacing.lg : 0) + (tabBarSpace ? 96 : insets.bottom),
    gap: padded ? spacing.lg : 0,
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
