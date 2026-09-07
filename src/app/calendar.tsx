import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '@/state/AuthProvider';
import { useUiStore } from '@/state/uiStore';
import { CalendarPanel } from '@/ui/components';
import { SlideScreen, useSlideBack } from '@/ui/motion/SlideScreen';

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
  const close = useSlideBack();
  const date = useUiStore((state) => state.selectedDate);
  const setSelectedDate = useUiStore((state) => state.setSelectedDate);

  return (
    <CalendarPanel
      visible
      presentation="screen"
      selected={date}
      dayDetail
      onClose={close}
      onSelect={setSelectedDate}
    />
  );
}
