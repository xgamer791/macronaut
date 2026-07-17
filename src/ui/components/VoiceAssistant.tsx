import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
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
  speakText,
  startHoldListen,
  stopSpeaking,
  unlockSpeechPlayback,
  type HoldListenSession,
} from '@/services/assistant/speech';
import { useDiaryEntries, useDayProgress, useSetting } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';

type Phase = 'idle' | 'holding' | 'thinking' | 'speaking';

const FAB_SIZE = 56;
const RING_SIZE = FAB_SIZE + 28;
/** Sit above the tab bar (bar ~64 + cradle + safe area cushion). */
const TAB_BAR_CLEARANCE = 96;

/** Kill iOS/Android/web long-press menus so hold-to-talk isn't interrupted. */
const noHoldChrome: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({
        userSelect: 'none',
        // WebKit / RN-web hold chrome
        ...({
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserDrag: 'none',
          touchAction: 'none',
        } as ViewStyle),
      } as ViewStyle)
    : undefined;

function HoldRing({
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
    const t = Math.max(0, (pulse.value - delay) / Math.max(0.001, 1 - delay));
    return {
      opacity: interpolate(t, [0, 0.08, 0.2, 1], [0, 0.7, 0.4, 0]),
      transform: [{ scale: interpolate(t, [0, 1], [1, maxScale]) }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.holdRing, { borderColor: color }, style]}
    />
  );
}

/**
 * Bottom-right mic FAB — hold to talk. While pressed, rings pulse around the
 * button; release to send and hear the reply. Native long-press chrome is
 * disabled so the OS hold menu can't steal the gesture.
 */
export function VoiceAssistant() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const date = useUiStore((s) => s.selectedDate);
  const progress = useDayProgress(date);
  const entries = useDiaryEntries(date);
  const apiKey = useSetting<string>('grokApiKey', '');

  const [phase, setPhase] = useState<Phase>('idle');
  const [history, setHistory] = useState<AssistantMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<HoldListenSession | null>(null);
  const turnGen = useRef(0);
  const holdingRef = useRef(false);

  const hold = useSharedValue(0);
  const pulse = useSharedValue(0);
  const breathe = useSharedValue(0);
  /** 0 idle · 1 holding · 2 thinking/speaking */
  const mode = useSharedValue(0);

  const keyReady = (apiKey.data ?? '').trim().length > 0;
  const speechOk = isSpeechRecognitionAvailable();
  const active = phase === 'holding' || phase === 'thinking' || phase === 'speaking';

  useEffect(() => {
    return () => {
      turnGen.current += 1;
      sessionRef.current?.abort();
      abortRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (phase === 'holding') {
      mode.value = 1;
      hold.value = withSpring(1, { damping: 14, stiffness: 180 });
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
      breathe.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else if (phase === 'thinking' || phase === 'speaking') {
      mode.value = 2;
      hold.value = withSpring(0.35, { damping: 16, stiffness: 180 });
      pulse.value = withTiming(0, { duration: 200 });
      breathe.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      mode.value = 0;
      hold.value = withSpring(0, { damping: 16, stiffness: 200 });
      pulse.value = withTiming(0, { duration: 160 });
      breathe.value = withTiming(0, { duration: 160 });
    }
  }, [phase, hold, pulse, breathe, mode]);

  async function runQuestion(question: string, gen: number) {
    const q = question.trim();
    if (!q || !keyReady) {
      setPhase('idle');
      return;
    }

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
      if (gen !== turnGen.current) return;
      setHistory((h) => [...h, { role: 'user', content: q }, { role: 'assistant', content: answer }]);
      setPhase('speaking');
      await speakText(answer);
      if (gen === turnGen.current) setPhase('idle');
    } catch {
      if (controller.signal.aborted || gen !== turnGen.current) return;
      setPhase('idle');
    }
  }

  function onPressIn() {
    if (phase === 'thinking' || phase === 'speaking') {
      turnGen.current += 1;
      abortRef.current?.abort();
      stopSpeaking();
    }
    if (!keyReady) {
      router.push('/settings');
      return;
    }
    if (!speechOk) return;

    holdingRef.current = true;
    unlockSpeechPlayback();
    stopSpeaking();
    sessionRef.current?.abort();
    sessionRef.current = startHoldListen();
    setPhase('holding');
  }

  async function onPressOut() {
    if (!holdingRef.current) return;
    holdingRef.current = false;

    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) {
      setPhase('idle');
      return;
    }

    const gen = ++turnGen.current;
    try {
      const transcript = await session.stop();
      if (gen !== turnGen.current) return;
      if (!transcript.trim()) {
        setPhase('idle');
        return;
      }
      await runQuestion(transcript, gen);
    } catch {
      if (gen !== turnGen.current) return;
      setPhase('idle');
    }
  }

  const bottom = insets.bottom + TAB_BAR_CLEARANCE;

  const fabAnim = useAnimatedStyle(() => {
    const pressScale = interpolate(hold.value, [0, 1], [1, 1.06]);
    const busyScale =
      mode.value >= 2 ? interpolate(breathe.value, [0, 1], [0.96, 1.04]) : 1;
    return { transform: [{ scale: pressScale * busyScale }] };
  });

  const fabColor =
    phase === 'holding'
      ? colors.danger
      : phase === 'thinking'
        ? colors.warning
        : colors.accent;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.anchor, { right: spacing.lg, bottom }, noHoldChrome]}
    >
      <HoldRing pulse={pulse} delay={0} maxScale={1.85} color={colors.danger} />
      <HoldRing pulse={pulse} delay={0.3} maxScale={2.35} color={colors.danger} />

      <Animated.View style={fabAnim}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voice assistant"
          accessibilityHint="Hold to talk, release when finished"
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={() => {
            /* swallow — disable OS long-press action */
          }}
          delayLongPress={10_000}
          // Prevent the browser context menu on long-press (RN web).
          {...(Platform.OS === 'web'
            ? {
                onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
              }
            : null)}
          unstable_pressDelay={0}
          style={[
            styles.fab,
            noHoldChrome,
            {
              backgroundColor: fabColor,
              shadowColor: '#000',
            },
          ]}
        >
          <View pointerEvents="none" style={noHoldChrome}>
            <Ionicons
              name={phase === 'holding' ? 'mic' : active ? 'mic' : 'mic-outline'}
              size={26}
              color={colors.onAccent}
            />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    width: RING_SIZE * 2.4,
    height: RING_SIZE * 2.4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    minWidth: touchTarget,
    minHeight: touchTarget,
  },
  holdRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
  },
});
