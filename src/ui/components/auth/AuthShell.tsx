import { Image } from 'expo-image';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/ui/theme/tokens';
import { authColors } from './theme';

const BG = require('../../../../assets/images/login/editorial-produce.png');

/** The editorial photo, the soft veil and the centred glass card every sign-in
 * surface shares. The card's contents are the screen's business. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width - spacing.xl * 2, 340);

  return (
    <View style={styles.root}>
      <Image
        source={BG}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={Platform.OS === 'web' ? 0 : 18}
      />
      {/* Soft blur veil so the glass card stays legible (matches mockup). */}
      <View
        style={[
          StyleSheet.absoluteFill,
          Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(10px) saturate(115%)',
                WebkitBackdropFilter: 'blur(10px) saturate(115%)',
                backgroundColor: 'rgba(255,255,255,0.12)',
              } as object)
            : { backgroundColor: 'rgba(255,255,255,0.18)' },
        ]}
      />

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.center,
            {
              paddingTop: insets.top + spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              minHeight: height,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              {
                width: cardWidth,
                ...(Platform.OS === 'web'
                  ? ({
                      backdropFilter: 'blur(28px) saturate(140%)',
                      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
                    } as object)
                  : null),
              },
            ]}
          >
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: authColors.page,
  },
  fill: { flex: 1 },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: authColors.cardBg,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: authColors.cardBorder,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 28,
    gap: 28,
    shadowColor: authColors.navy,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
});
