import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { TabBar } from '@/ui/components/TabBar';
import { VoiceAssistant } from '@/ui/components/VoiceAssistant';

export default function TabsLayout() {
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false);

  if (loading || onboarded.isLoading) return null;
  if (!signedIn) return <Redirect href="/login" />;
  if (!onboarded.data) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="meals" />
        <Tabs.Screen name="progress" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <VoiceAssistant />
    </View>
  );
}
