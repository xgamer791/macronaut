import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  right?: React.ReactNode;
  left?: React.ReactNode;
  destructive?: boolean;
  accessibilityHint?: string;
}

export function ListRow({
  title,
  subtitle,
  value,
  onPress,
  onLongPress,
  selected,
  right,
  left,
  destructive,
  accessibilityHint,
}: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <>
      {left}
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="body" tone={destructive ? 'danger' : 'primary'} numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="micro" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="caption" tone="secondary">
          {value}
        </AppText>
      ) : null}
      {right}
    </>
  );

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    minHeight: touchTarget,
    paddingVertical: spacing.sm,
    backgroundColor: selected ? colors.track : 'transparent',
    borderRadius: 8,
    paddingHorizontal: selected ? spacing.sm : 0,
  };

  if (!onPress && !onLongPress) return <View style={rowStyle}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}${value ? `, ${value}` : ''}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}
