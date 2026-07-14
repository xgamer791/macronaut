import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { useSetting } from '@/state/queries';
import { TabBar } from '@/ui/components/TabBar';

export default function TabsLayout() {
  const onboarded = useSetting<boolean>('onboardingComplete', false);

  if (onboarded.isLoading) return null;
  if (!onboarded.data) return <Redirect href="/onboarding" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="diary" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
