import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthMode, PROVIDER_ORDER, ProviderId, providerLabel } from '@/services/auth/providers';
import { AuthPill } from './AuthPill';
import { AppleLogo, GoogleG } from './icons';

export interface ProviderButtonsProps {
  mode: AuthMode;
  busy: boolean;
  onApple: () => void;
  onGoogle: () => void;
  onEmail: () => void;
}

/** Apple, Google, Email — the same three pills on both screens, worded for
 * signing in or signing up. */
export function ProviderButtons({ mode, busy, onApple, onGoogle, onEmail }: ProviderButtonsProps) {
  const handlers: Record<ProviderId, () => void> = { apple: onApple, google: onGoogle, email: onEmail };
  const icons: Record<ProviderId, React.ReactNode> = {
    apple: <AppleLogo />,
    google: <GoogleG />,
    email: <Ionicons name="mail-outline" size={20} color="#FFFFFF" />,
  };
  const variants = { apple: 'apple', google: 'google', email: 'navy' } as const;

  return (
    <View style={styles.actions}>
      {PROVIDER_ORDER.map((provider) => (
        <AuthPill
          key={provider}
          label={providerLabel(mode, provider)}
          variant={variants[provider]}
          icon={icons[provider]}
          disabled={busy}
          onPress={handlers[provider]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    width: '100%',
  },
});
