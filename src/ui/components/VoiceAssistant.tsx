import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  askNutritionAssistant,
  type AssistantMessage,
} from '@/services/assistant/grokChat';
import { buildNutritionContext } from '@/services/assistant/nutritionContext';
import {
  isSpeechRecognitionAvailable,
  listenOnce,
  speakText,
  stopSpeaking,
} from '@/services/assistant/speech';
import { useDiaryEntries, useDayProgress, useSetting } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';

const FAB_SIZE = 56;
const MIC_IDLE = 96;
const MIC_LISTEN = 128;
/** Sit above the tab bar (bar ~64 + cradle + safe area cushion). */
const TAB_BAR_CLEARANCE = 96;

function WaveBar({
  index,
  wave,
  color,
}: {
  index: number;
  wave: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const t = (wave.value + index * 0.14) % 1;
    const height = interpolate(t, [0, 0.5, 1], [12, 34 + index * 3, 12]);
    return { height };
  });
  return <Animated.View style={[styles.waveBar, { backgroundColor: color }, style]} />;
}

function PulseRing({
  pulse,
  delay,
  maxScale,
  color,
}: {
  pulse: SharedValue<number>;
  delay: number;
  maxScale: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, (pulse.value - delay) / (1 - delay));
    return {
      opacity: interpolate(t, [0, 0.12, 1], [0.5, 0.35, 0]),
      transform: [{ scale: interpolate(t, [0, 1], [1, maxScale]) }],
    };
  });
  return <Animated.View style={[styles.ring, { borderColor: color }, style]} />;
}

/**
 * Bottom-right mic FAB. Tap opens a minimal listening overlay: one expanding
 * microphone with pulse rings — no copy, no text fields.
 */
export function VoiceAssistant() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const date = useUiStore((s) => s.selectedDate);
  const progress = useDayProgress(date);
  const entries = useDiaryEntries(date);
  const apiKey = useSetting<string>('grokApiKey', '');

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [history, setHistory] = useState<AssistantMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const listenGen = useRef(0);

  const expand = useSharedValue(0);
  const pulse = useSharedValue(0);
  const wave = useSharedValue(0);
  /** 0 idle overlay, 1 listening, 2 thinking/speaking */
  const mode = useSharedValue(0);

  const keyReady = (apiKey.data ?? '').trim().length > 0;
  const speechOk = isSpeechRecognitionAvailable();

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (phase === 'listening') {
      mode.value = 1;
      expand.value = withSpring(1, { damping: 13, stiffness: 150 });
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
      wave.value = withRepeat(
        withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else if (phase === 'thinking' || phase === 'speaking') {
      mode.value = 2;
      expand.value = withSpring(0.72, { damping: 16, stiffness: 180 });
      pulse.value = withTiming(0, { duration: 200 });
      wave.value = withRepeat(
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      mode.value = 0;
      expand.value = withSpring(0, { damping: 16, stiffness: 200 });
      pulse.value = withTiming(0, { duration: 180 });
      wave.value = withTiming(0, { duration: 180 });
    }
  }, [phase, expand, pulse, wave, mode]);

  function closeOverlay() {
    listenGen.current += 1;
    abortRef.current?.abort();
    stopSpeaking();
    setOpen(false);
    setPhase('idle');
  }

  async function runQuestion(question: string, gen: number) {
    const q = question.trim();
    if (!q || !keyReady) return;

    setPhase('thinking');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const nutritionContext = buildNutritionContext({
      date,
      progress,
      entries: entries.data ?? [],
    });

    try {
      const answer = await askNutritionAssistant({
        apiKey: apiKey.data ?? '',
        nutritionContext,
        question: q,
        history,
        signal: controller.signal,
      });
      if (gen !== listenGen.current) return;
      setHistory((h) => [...h, { role: 'user', content: q }, { role: 'assistant', content: answer }]);
      setPhase('speaking');
      speakText(answer);
      setTimeout(() => {
        if (gen === listenGen.current) closeOverlay();
      }, 900);
    } catch {
      if (controller.signal.aborted || gen !== listenGen.current) return;
      closeOverlay();
    }
  }

  async function startListening() {
    if (!keyReady) {
      router.push('/settings');
      return;
    }
    if (!speechOk) return;

    const gen = ++listenGen.current;
    setOpen(true);
    setPhase('listening');
    stopSpeaking();

    try {
      const { transcript } = await listenOnce({ timeoutMs: 20_000 });
      if (gen !== listenGen.current) return;
      await runQuestion(transcript, gen);
    } catch {
      if (gen !== listenGen.current) return;
      closeOverlay();
    }
  }

  function onFabPress() {
    if (open) {
      closeOverlay();
      return;
    }
    void startListening();
  }

  const bottom = insets.bottom + TAB_BAR_CLEARANCE;

  const micStyle = useAnimatedStyle(() => {
    const size = interpolate(expand.value, [0, 1], [MIC_IDLE, MIC_LISTEN]);
    const breathe =
      mode.value >= 2 ? interpolate(wave.value, [0, 1], [0.95, 1.05]) : 1;
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [{ scale: breathe }],
    };
  });

  const micColor =
    phase === 'listening' ? colors.danger : phase === 'thinking' ? colors.warning : colors.accent;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voice assistant"
        accessibilityHint="Starts listening for a nutrition question"
        onPress={onFabPress}
        style={({ pressed }) => [
          styles.fab,
          {
            right: spacing.lg,
            bottom,
            backgroundColor: open ? colors.danger : colors.accent,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
            shadowColor: '#000',
          },
        ]}
      >
        <Ionicons name={open ? 'close' : 'mic-outline'} size={26} color={colors.onAccent} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeOverlay}>
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          onPress={closeOverlay}
          accessibilityRole="button"
          accessibilityLabel="Cancel voice assistant"
        >
          <View style={styles.micWrap} pointerEvents="none">
            {phase === 'listening' ? (
              <>
                <PulseRing pulse={pulse} delay={0} maxScale={2.15} color={colors.danger} />
                <PulseRing pulse={pulse} delay={0.28} maxScale={2.7} color={colors.danger} />
              </>
            ) : null}

            <Animated.View style={[styles.micButton, { backgroundColor: micColor }, micStyle]}>
              {phase === 'listening' ? (
                <View style={styles.waveRow}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <WaveBar key={i} index={i} wave={wave} color={colors.onAccent} />
                  ))}
                </View>
              ) : (
                <Ionicons name="mic" size={42} color={colors.onAccent} />
              )}
            </Animated.View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 8,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    minWidth: touchTarget,
    minHeight: touchTarget,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micWrap: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: MIC_LISTEN,
    height: MIC_LISTEN,
    borderRadius: MIC_LISTEN / 2,
    borderWidth: 3,
  },
  micButton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
  },
  waveBar: {
    width: 5,
    borderRadius: 3,
  },
});
