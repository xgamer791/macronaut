import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { LiquidGlassCard } from './LiquidGlassCard';

type IconName = keyof typeof Ionicons.glyphMap;

const TOOLS: { title: string; subtitle: string; icon: IconName; href: Href }[] = [
  {
    title: 'Fasting tracker',
    subtitle: 'Start a timer or schedule a fast',
    icon: 'timer-outline',
    href: '/fasting',
  },
  {
    title: 'Log food',
    subtitle: 'Add a meal or scan food',
    icon: 'restaurant-outline',
    href: '/add',
  },
  {
    title: 'Log activity',
    subtitle: 'Record a workout or movement',
    icon: 'barbell-outline',
    href: '/activity',
  },
];

const MENU_HEIGHT = 248;
/** Exact gap between the tools button and the top of the tab bar. The
 * tab scene already sits above that chrome, so this is not compounded
 * with the home-indicator inset. */
const FAB_ABOVE_FOOTER = 20;

/** Expandable home utility tray. It is intentionally data-driven so future
 * Macronaut tools only need another item in `TOOLS`. */
export function ToolLauncher() {
  const router = useRouter();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [open, progress]);

  const menuHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [0, MENU_HEIGHT] });
  const menuOpacity = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.anchor, { bottom: FAB_ABOVE_FOOTER, right: spacing.lg }]}
    >
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[styles.menuClip, { height: menuHeight, opacity: menuOpacity }]}
      >
        <LiquidGlassCard contentStyle={styles.menuContent}>
          <View style={styles.menuHeading}>
            <View>
              <AppText variant="heading" weight="600" display>
                Tools
              </AppText>
              <AppText variant="micro" tone="secondary">
                Quick access
              </AppText>
            </View>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
          </View>

          {TOOLS.map((tool) => (
            <Pressable
              key={tool.title}
              accessibilityRole="button"
              accessibilityLabel={tool.title}
              accessibilityHint={tool.subtitle}
              onPress={() => {
                setOpen(false);
                void Haptics.selectionAsync();
                router.push(tool.href);
              }}
              style={({ pressed }) => [
                styles.toolRow,
                { borderTopColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.toolIcon, { backgroundColor: `${colors.accent}1F` }]}>
                <Ionicons name={tool.icon} size={20} color={colors.accent} />
              </View>
              <View style={styles.toolCopy}>
                <AppText variant="body" weight="600">
                  {tool.title}
                </AppText>
                <AppText variant="micro" tone="secondary" numberOfLines={1}>
                  {tool.subtitle}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
            </Pressable>
          ))}
        </LiquidGlassCard>
      </Animated.View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close tools menu' : 'Open tools menu'}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void Haptics.selectionAsync();
          setOpen((value) => !value);
        }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.accent },
          pressed && styles.buttonPressed,
        ]}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="add" size={30} color={colors.onAccent} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    zIndex: 60,
    alignItems: 'flex-end',
  },
  menuClip: {
    width: 286,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  menuContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  menuHeading: {
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolRow: {
    minHeight: 57,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCopy: { flex: 1, gap: 1 },
  pressed: { opacity: 0.68 },
  button: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.97 }] },
});
