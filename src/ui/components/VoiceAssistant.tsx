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
import { useQueryClient } from '@tanstack/react-query';
import {
  runAssistantAgent,
  type AssistantMessage,
} from '@/services/assistant/grokChat';
import { buildNutritionContext } from '@/services/assistant/nutritionContext';
import {
  canHoldRecord,
  ensureMicStream,
  speakText,
  startHoldListen,
  stopSpeaking,
  unlockAudioContext,
  unlockSpeechPlayback,
  type HoldListenSession,
} from '@/services/assistant/speech';
import { transcribeAudio } from '@/services/assistant/stt';
import { spokenAbortError } from '@/services/assistant/agentPolicy';
import type { ToolInvalidate } from '@/services/assistant/toolExecutor';
import { speakWithGrokTts, stopAudioElement, unlockAudioElement } from '@/services/assistant/tts';
import { useRepos } from '@/state/AppProvider';
import { keys, useDiaryEntries, useDayProgress, useSetting } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';

type Phase = 'idle' | 'holding' | 'thinking' | 'speaking';

const FAB_SIZE = 56;
const RING_SIZE = FAB_SIZE + 28;
const TAB_BAR_CLEARANCE = 96;

const noHoldChrome: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({
        userSelect: 'none',
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

function ThinkingDot({
  t,
  delay,
  color,
}: {
  t: SharedValue<number>;
  delay: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const p = (t.value + delay) % 1;
    return {
      opacity: interpolate(p, [0, 0.25, 0.5, 1], [0.25, 1, 0.25, 0.25]),
      transform: [{ translateY: interpolate(p, [0, 0.25, 0.5, 1], [0, -3, 0, 0]) }],
    };
  });
  return <Animated.View style={[styles.thinkingDot, { backgroundColor: color }, style]} />;
}

/** Animated three-dot "thinking" indicator. */
function ThinkingDots({ color }: { color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
  }, [t]);
  return (
    <View pointerEvents="none" style={styles.thinkingRow}>
      <ThinkingDot t={t} delay={0} color={color} />
      <ThinkingDot t={t} delay={0.18} color={color} />
      <ThinkingDot t={t} delay={0.36} color={color} />
    </View>
  );
}

/**
 * Hold-to-talk agent. Records audio, transcribes, runs Grok with app tools
 * (diary, notes, activity, memory), and speaks replies. Remembers prior turns
 * so "make a note of that" works.
 */
export function VoiceAssistant() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const repos = useRepos();
  const queryClient = useQueryClient();
  const date = useUiStore((s) => s.selectedDate);
  const targetMeal = useUiStore((s) => s.targetMeal);
  const progress = useDayProgress(date);
  const entries = useDiaryEntries(date);
  const apiKey = useSetting<string>('grokApiKey', '');

  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState<string | null>(null);
  const [micReady, setMicReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<HoldListenSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const turnGen = useRef(0);
  const holdingRef = useRef(false);
  const pressStartedAt = useRef(0);
  const historyRef = useRef<AssistantMessage[]>([]);

  const hold = useSharedValue(0);
  const pulse = useSharedValue(0);
  const breathe = useSharedValue(0);
  const mode = useSharedValue(0);

  const keyReady = (apiKey.data ?? '').trim().length > 0;
  const recordOk = canHoldRecord();
  const active = phase !== 'idle';

  useEffect(() => {
    return () => {
      turnGen.current += 1;
      sessionRef.current?.abort();
      abortRef.current?.abort();
      stopSpeaking();
      stopAudioElement();
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

  async function speakReply(message: string, gen: number) {
    setPhase('speaking');
    setStatus(message);
    const key = apiKey.data ?? '';
    // Grok Ara (warm middle-aged American woman) plays through the audio element
    // we unlocked on press — the reliable path on iOS Safari after async work.
    // Browser speechSynthesis is only a fallback because it's often blocked here.
    try {
      await speakWithGrokTts({ apiKey: key, text: message });
    } catch {
      try {
        await speakText(message);
      } catch {
        /* both paths failed — status text still shows the reply */
      }
    }
    if (gen === turnGen.current) {
      setPhase('idle');
      setTimeout(() => {
        if (gen === turnGen.current) setStatus(null);
      }, 4500);
    }
  }

  function applyInvalidations(list: ToolInvalidate[]) {
    for (const inv of list) {
      if (inv.kind === 'diary') {
        if (inv.date) void queryClient.invalidateQueries({ queryKey: keys.diary(inv.date) });
        void queryClient.invalidateQueries({ queryKey: ['diary'] });
        void queryClient.invalidateQueries({ queryKey: ['diary-range'] });
        void queryClient.invalidateQueries({ queryKey: keys.recents });
        void queryClient.invalidateQueries({ queryKey: ['frequents'] });
      } else if (inv.kind === 'activity') {
        if (inv.date) void queryClient.invalidateQueries({ queryKey: keys.activity(inv.date) });
        void queryClient.invalidateQueries({ queryKey: ['activity'] });
        void queryClient.invalidateQueries({ queryKey: ['activity-range'] });
      } else if (inv.kind === 'notes') {
        if (inv.date) void queryClient.invalidateQueries({ queryKey: keys.dayNotes(inv.date) });
        void queryClient.invalidateQueries({ queryKey: ['day-notes'] });
        void queryClient.invalidateQueries({ queryKey: ['day-notes-range'] });
      }
    }
  }

  async function answerQuestion(question: string, gen: number, signal: AbortSignal) {
    setStatus(`Heard: “${question}”`);
    const nutritionContext = buildNutritionContext({
      date,
      progress,
      entries: entries.data ?? [],
    });
    const result = await runAssistantAgent({
      apiKey: apiKey.data ?? '',
      nutritionContext,
      question,
      repos,
      selectedDate: date,
      targetMeal: targetMeal || 'breakfast',
      history: historyRef.current,
      signal,
      onStatus: (s) => {
        if (gen === turnGen.current) setStatus(s);
      },
    });
    if (gen !== turnGen.current) return;
    const nextHistory: AssistantMessage[] = [
      ...historyRef.current,
      { role: 'user', content: question },
      { role: 'assistant', content: result.answer },
    ];
    historyRef.current = nextHistory.slice(-20);
    applyInvalidations(result.invalidates);
    await speakReply(result.answer, gen);
  }

  async function runTurn(blob: Blob, gen: number) {
    if (!keyReady) {
      setPhase('idle');
      setStatus('Add your Grok API key in Settings');
      return;
    }

    setPhase('thinking');
    setStatus('Thinking…');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (!blob || blob.size < 1000) {
        await speakReply(
          'I didn’t hear anything. Hold the mic, speak clearly, then let go.',
          gen,
        );
        return;
      }
      setStatus('Transcribing…');
      const question = await transcribeAudio({
        apiKey: apiKey.data ?? '',
        blob,
        filename: blob.type.includes('wav') ? 'voice.wav' : undefined,
        signal: controller.signal,
      });
      if (gen !== turnGen.current) return;
      await answerQuestion(question, gen, controller.signal);
    } catch (e) {
      if (gen !== turnGen.current) {
        setPhase('idle');
        return;
      }
      const abortMsg = spokenAbortError(e);
      if (abortMsg || controller.signal.aborted) {
        const spoken = abortMsg ?? 'Cancelled.';
        setStatus(spoken);
        await speakReply(spoken, gen);
        return;
      }
      const msg =
        e instanceof Error && e.message
          ? e.message
          : 'Something went wrong with the voice assistant.';
      const spoken =
        msg.length > 140 || /[{}]/.test(msg)
          ? "Sorry, I couldn't get an answer. Check your Grok key and try again."
          : msg;
      setStatus(spoken);
      await speakReply(spoken, gen);
    }
  }

  async function onPressIn() {
    if (phase === 'thinking' || phase === 'speaking') {
      turnGen.current += 1;
      abortRef.current?.abort();
      stopSpeaking();
      stopAudioElement();
    }
    if (!keyReady) {
      setStatus('Add your Grok API key in Settings');
      router.push('/settings');
      return;
    }
    if (!recordOk) {
      setStatus('This browser cannot record audio');
      return;
    }

    unlockAudioElement();
    unlockSpeechPlayback();
    // Must resume AudioContext inside the press gesture (iOS Safari).
    void unlockAudioContext().catch(() => {});
    pressStartedAt.current = Date.now();
    holdingRef.current = true;
    setStatus('Listening…');
    setPhase('holding');

    try {
      // Warm mic first so the iOS permission sheet doesn't cancel the hold.
      if (!micReady || !streamRef.current) {
        setStatus('Allow microphone…');
        await unlockAudioContext();
        streamRef.current = await ensureMicStream();
        setMicReady(true);
        // If they already released during the permission prompt, don't record.
        if (!holdingRef.current) {
          setPhase('idle');
          setStatus('Mic ready — hold to talk');
          return;
        }
        setStatus('Listening…');
      } else {
        await unlockAudioContext();
      }

      sessionRef.current?.abort();
      sessionRef.current = startHoldListen(streamRef.current ?? undefined);
    } catch (e) {
      holdingRef.current = false;
      setPhase('idle');
      setStatus(e instanceof Error ? e.message : 'Microphone failed');
    }
  }

  async function onPressOut() {
    if (!holdingRef.current) return;
    holdingRef.current = false;

    const heldMs = Date.now() - pressStartedAt.current;
    const session = sessionRef.current;
    sessionRef.current = null;

    // Released during permission / before recorder started.
    if (!session) {
      setPhase('idle');
      if (micReady) setStatus('Mic ready — hold to talk');
      return;
    }

    // Too short — likely an accidental tap.
    if (heldMs < 350) {
      session.abort();
      setPhase('idle');
      setStatus('Hold the mic while you talk, then release');
      return;
    }

    const gen = ++turnGen.current;
    setPhase('thinking');
    setStatus('Thinking…');
    try {
      const blob = await session.stop();
      if (gen !== turnGen.current) return;
      await runTurn(blob, gen);
    } catch (e) {
      if (gen !== turnGen.current) return;
      const msg = e instanceof Error ? e.message : "I couldn't record that.";
      setStatus(msg);
      await speakReply(msg, gen);
    }
  }

  const bottom = insets.bottom + TAB_BAR_CLEARANCE;

  const fabAnim = useAnimatedStyle(() => {
    const pressScale = interpolate(hold.value, [0, 1], [1, 1.08]);
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
      {status ? (
        <View
          pointerEvents="none"
          style={[styles.statusBubble, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
        >
          <AppText variant="micro" tone="secondary" numberOfLines={4}>
            {status}
          </AppText>
          {phase === 'thinking' ? <ThinkingDots color={colors.accent} /> : null}
        </View>
      ) : null}

      <HoldRing pulse={pulse} delay={0} maxScale={1.85} color={colors.danger} />
      <HoldRing pulse={pulse} delay={0.3} maxScale={2.35} color={colors.danger} />

      <Animated.View style={fabAnim}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voice assistant"
          accessibilityHint="Hold to talk, release when finished"
          onPressIn={() => void onPressIn()}
          onPressOut={() => void onPressOut()}
          onLongPress={() => {}}
          delayLongPress={10_000}
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
    width: 220,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  statusBubble: {
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    zIndex: 2,
  },
  holdRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    bottom: (FAB_SIZE - RING_SIZE) / 2,
  },
});
