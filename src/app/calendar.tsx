import { Redirect, useRouter } from 'expo-router';
import { CalendarPlusIcon } from 'phosphor-react-native';
import React from 'react';
import { useAuth } from '@/state/AuthProvider';
import { useUiStore } from '@/state/uiStore';
import { CalendarPanel } from '@/ui/components';
import { SlideScreen, useSlideBack } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';

const HEADER_ICON_SIZE = 22;

export default function CalendarRoute() {
  const { loading, signedIn } = useAuth();
  if (loading) return null;
  if (!signedIn) return <Redirect href="/welcome" />;
  return (
    <SlideScreen from="right">
      <CalendarScreen />
    </SlideScreen>
  );
}

function CalendarScreen() {
  const router = useRouter();
  const close = useSlideBack();
  const { colors } = useTheme();
  const date = useUiStore((state) => state.selectedDate);
  const setSelectedDate = useUiStore((state) => state.setSelectedDate);

  return (
    <CalendarPanel
      visible
      presentation="screen"
      selected={date}
      dayDetail
      headerAction={{
        accessibilityLabel: 'Open training schedule',
        icon: <CalendarPlusIcon size={HEADER_ICON_SIZE} color={colors.accent} weight="regular" />,
        onPress: () => router.push('/training-schedule'),
      }}
      onClose={close}
      onSelect={setSelectedDate}
    />
  );
}
