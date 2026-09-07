import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { TabBar } from '@/ui/components/TabBar';
import { SlidePushLayer } from '@/ui/motion/SlidePush';

export default function TabsLayout() {
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (!signedIn) return <Redirect href="/welcome" />;
  if (!onboarded.data) return <Redirect href="/onboarding" />;

  // Wrapped whole, tab bar included: a slide-out pushes the shell aside, and
  // a page that left while its tab bar stayed would read as two screens.
  return (
    <SlidePushLayer>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="meals" />
        <Tabs.Screen name="progress" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </SlidePushLayer>
  );
}
