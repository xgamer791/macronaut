import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { View } from 'react-native';
import { useSetting } from '@/state/queries';
import { TabBar } from '@/ui/components/TabBar';
import { VoiceAssistant } from '@/ui/components/VoiceAssistant';

export default function TabsLayout() {
  const auth = useSetting<boolean>('authComplete', false);
  const onboarded = useSetting<boolean>('onboardingComplete', false);

  if (auth.isLoading || onboarded.isLoading) return null;
  if (!auth.data) return <Redirect href="/login" />;
  if (!onboarded.data) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="diary" />
        <Tabs.Screen name="progress" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <VoiceAssistant />
    </View>
  );
}
