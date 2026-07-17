import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
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
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { TextField } from './TextField';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';

const FAB_SIZE = 56;
/** Sit above the tab bar (bar ~64 + cradle + safe area cushion). */
const TAB_BAR_CLEARANCE = 96;

/**
 * Bottom-right mic FAB + sheet. Tap to enable the microphone, speak a nutrition
 * question, and get a Grok answer grounded in today's remaining calories/macros.
 * Uses the same on-device Grok API key as AI food scan.
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
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AssistantMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const keyReady = (apiKey.data ?? '').trim().length > 0;
  const speechOk = isSpeechRecognitionAvailable();
  const busy = phase === 'listening' || phase === 'thinking';

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  function closeSheet() {
    abortRef.current?.abort();
    stopSpeaking();
    setOpen(false);
    setPhase('idle');
    setError(null);
  }

  async function runQuestion(question: string) {
    const q = question.trim();
    if (!q) return;
    if (!keyReady) {
      setError('Add your Grok API key in Settings to use the voice assistant.');
      return;
    }

    setError(null);
    setPhase('thinking');
    setDraft('');
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
      setHistory((h) => [...h, { role: 'user', content: q }, { role: 'assistant', content: answer }]);
      setPhase('speaking');
      speakText(answer);
      setPhase('idle');
    } catch (e) {
      if (controller.signal.aborted) {
        setPhase('idle');
        return;
      }
      setError(e instanceof Error ? e.message : 'Assistant failed');
      setPhase('idle');
    }
  }

  async function startListening() {
    if (!keyReady) {
      setOpen(true);
      setError('Add your Grok API key in Settings to use the voice assistant.');
      return;
    }
    if (!speechOk) {
      setOpen(true);
      setError('Microphone voice input needs Chrome (or another browser with speech recognition). You can still type below.');
      return;
    }

    setOpen(true);
    setError(null);
    setPhase('listening');
    stopSpeaking();

    try {
      const { transcript } = await listenOnce();
      setDraft(transcript);
      await runQuestion(transcript);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone failed');
      setPhase('idle');
    }
  }

  function onFabPress() {
    if (open && phase === 'listening') return;
    void startListening();
  }

  const bottom = insets.bottom + TAB_BAR_CLEARANCE;
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  const lastUser = [...history].reverse().find((m) => m.role === 'user');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voice assistant"
        accessibilityHint="Opens the microphone so you can ask about calories and nutrition"
        onPress={onFabPress}
        style={({ pressed }) => [
          styles.fab,
          {
            right: spacing.lg,
            bottom,
            backgroundColor: phase === 'listening' ? colors.danger : colors.accent,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
            shadowColor: '#000',
          },
        ]}
      >
        {phase === 'thinking' ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Ionicons
            name={phase === 'listening' ? 'mic' : 'mic-outline'}
            size={26}
            color={colors.onAccent}
          />
        )}
      </Pressable>

      <Sheet visible={open} onClose={closeSheet} title="Voice assistant">
        <AppText variant="caption" tone="secondary">
          Ask about remaining calories, protein, or what to eat next. Uses your Grok API key from
          Settings.
        </AppText>

        {!keyReady ? (
          <Button
            title="Add Grok API key"
            onPress={() => {
              closeSheet();
              router.push('/settings');
            }}
          />
        ) : null}

        <View style={styles.statusRow}>
          <View
            style={[
              styles.pulse,
              {
                backgroundColor:
                  phase === 'listening'
                    ? colors.danger
                    : phase === 'thinking'
                      ? colors.warning
                      : colors.accent,
              },
            ]}
          />
          <AppText variant="caption" tone="secondary">
            {phase === 'listening'
              ? 'Listening… speak now'
              : phase === 'thinking'
                ? 'Thinking…'
                : phase === 'speaking'
                  ? 'Speaking answer…'
                  : speechOk
                    ? 'Tap the mic to speak, or type below'
                    : 'Type a question (voice needs Chrome)'}
          </AppText>
        </View>

        {error ? (
          <AppText variant="caption" tone="danger">
            {error}
          </AppText>
        ) : null}

        {lastUser ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="micro" tone="muted">
              You
            </AppText>
            <AppText variant="body">{lastUser.content}</AppText>
          </View>
        ) : null}

        {lastAssistant ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="micro" tone="muted">
              Assistant
            </AppText>
            <AppText variant="body">{lastAssistant.content}</AppText>
            <Button
              title="Hear again"
              variant="ghost"
              compact
              onPress={() => speakText(lastAssistant.content)}
            />
          </View>
        ) : null}

        <TextField
          label="Or type a question"
          value={draft}
          onChangeText={setDraft}
          placeholder="How many calories do I have left?"
          editable={!busy}
          onSubmitEditing={() => void runQuestion(draft)}
        />

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title={phase === 'listening' ? 'Listening…' : 'Speak'}
            onPress={() => void startListening()}
            loading={phase === 'listening'}
            disabled={busy && phase !== 'listening'}
            compact
          />
          <Button
            title="Ask"
            variant="secondary"
            onPress={() => void runQuestion(draft)}
            loading={phase === 'thinking'}
            disabled={busy || !draft.trim()}
            compact
          />
          {history.length ? (
            <Button
              title="Clear"
              variant="ghost"
              compact
              disabled={busy}
              onPress={() => {
                stopSpeaking();
                setHistory([]);
                setDraft('');
                setError(null);
              }}
            />
          ) : null}
        </View>
      </Sheet>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pulse: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
});
