import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionErrorCode,
} from 'expo-speech-recognition';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PickedAttachment } from '@/services/media/pickedAttachment';
import { AppText } from '@/ui/components';
import { useComposerKeyboardGap } from '@/ui/motion/useComposerKeyboardGap';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';

const ATTACHMENT_MENU_HEIGHT = 82;
type IconName = keyof typeof Ionicons.glyphMap;

function dictatedMessage(existing: string, transcript: string): string {
  return [existing.trimEnd(), transcript.trim()].filter(Boolean).join(' ').slice(0, 2000);
}

function dictationErrorMessage(error: ExpoSpeechRecognitionErrorCode): string | null {
  if (error === 'aborted') return null;
  if (error === 'not-allowed') return 'Allow microphone access to use speech to text.';
  if (error === 'no-speech' || error === 'speech-timeout') {
    return "I didn't hear anything. Tap the microphone and try again.";
  }
  if (error === 'network') return 'Speech recognition needs a network connection.';
  if (error === 'language-not-supported')
    return 'Speech recognition is unavailable in this language.';
  return 'Speech recognition is unavailable right now.';
}

export interface MessageComposerProps {
  draft: string;
  onDraft: (value: string) => void;
  attachment: PickedAttachment | null;
  onAttach: () => void;
  onTakePhoto: () => void;
  onOpenGiphy: () => void;
  onOpenMaps: () => void;
  onRemoveAttachment: () => void;
  onSend: () => void;
  sending: boolean;
  error: string | null;
  /** Who the message goes to, for the input's screen-reader label. */
  accessibilityLabel: string;
}

/**
 * The bottom of a conversation: attachment menu, the picked attachment, the
 * text input with voice typing, and send. It docks on the keyboard gap
 * itself, so a screen only has to place it last. Shared by direct and group
 * chats, which differ only in where the message goes.
 */
export function MessageComposer({
  draft,
  onDraft,
  attachment,
  onAttach,
  onTakePhoto,
  onOpenGiphy,
  onOpenMaps,
  onRemoveAttachment,
  onSend,
  sending,
  error,
  accessibilityLabel,
}: MessageComposerProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    paddingBottom: composerPad,
    onFocus: onComposerFocus,
    onBlur: onComposerBlur,
  } = useComposerKeyboardGap(Math.max(insets.bottom, spacing.sm));
  const [menuProgress] = useState(() => new Animated.Value(0));
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [startingDictation, setStartingDictation] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const dictationBase = useRef('');
  const canSend = Boolean(draft.trim() || attachment) && !sending;

  useSpeechRecognitionEvent('start', () => {
    setStartingDictation(false);
    setListening(true);
  });
  useSpeechRecognitionEvent('end', () => {
    setStartingDictation(false);
    setListening(false);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) onDraft(dictatedMessage(dictationBase.current, transcript));
  });
  useSpeechRecognitionEvent('error', (event) => {
    setStartingDictation(false);
    setListening(false);
    setDictationError(dictationErrorMessage(event.error));
  });

  useEffect(
    () => () => {
      ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  useEffect(() => {
    Animated.timing(menuProgress, {
      toValue: attachmentMenuOpen ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [attachmentMenuOpen, menuProgress]);

  const menuHeight = menuProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ATTACHMENT_MENU_HEIGHT],
  });
  const menuOpacity = menuProgress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0, 1],
  });
  const plusRotation = menuProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  async function toggleDictation() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (startingDictation) return;

    setDictationError(null);
    setStartingDictation(true);
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setDictationError('Speech to text is not supported on this device or browser.');
        setStartingDictation(false);
        return;
      }

      if (Platform.OS !== 'web') {
        const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!permission.granted) {
          setDictationError('Allow microphone access to use speech to text.');
          setStartingDictation(false);
          return;
        }
      }

      dictationBase.current = draft;
      ExpoSpeechRecognitionModule.start({
        lang: Intl.DateTimeFormat().resolvedOptions().locale || 'en-US',
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
      });
    } catch {
      setStartingDictation(false);
      setListening(false);
      setDictationError('Speech recognition is unavailable right now.');
    }
  }

  function submitMessage() {
    if (listening || startingDictation) ExpoSpeechRecognitionModule.abort();
    setAttachmentMenuOpen(false);
    onSend();
  }

  return (
    <View
      style={[
        styles.composerWrap,
        {
          backgroundColor: colors.background,
          paddingBottom: composerPad,
        },
      ]}
    >
      {error || dictationError ? (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error ?? dictationError}
        </AppText>
      ) : null}

      {attachment ? (
        <AttachmentPreview attachment={attachment} busy={sending} onRemove={onRemoveAttachment} />
      ) : null}

      <Animated.View
        pointerEvents={attachmentMenuOpen ? 'auto' : 'none'}
        accessibilityElementsHidden={!attachmentMenuOpen}
        importantForAccessibility={attachmentMenuOpen ? 'auto' : 'no-hide-descendants'}
        style={[styles.attachmentMenuClip, { height: menuHeight, opacity: menuOpacity }]}
      >
        <View style={[styles.attachmentMenu, { backgroundColor: colors.surfaceRaised }]}>
          <AttachmentAction
            icon="images-outline"
            label="Photos"
            onPress={() => {
              setAttachmentMenuOpen(false);
              onAttach();
            }}
          />
          <AttachmentAction
            icon="camera-outline"
            label="Camera"
            onPress={() => {
              setAttachmentMenuOpen(false);
              onTakePhoto();
            }}
          />
          <AttachmentAction
            icon="sparkles-outline"
            label="GIF"
            onPress={() => {
              setAttachmentMenuOpen(false);
              onOpenGiphy();
            }}
          />
          <AttachmentAction
            icon="location-outline"
            label="Location"
            onPress={() => {
              setAttachmentMenuOpen(false);
              onOpenMaps();
            }}
          />
        </View>
      </Animated.View>

      <View style={styles.composer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={attachmentMenuOpen ? 'Close attachment menu' : 'Open attachment menu'}
          accessibilityState={{ expanded: attachmentMenuOpen }}
          disabled={sending}
          onPress={() => setAttachmentMenuOpen((open) => !open)}
          hitSlop={6}
          style={({ pressed }) => [
            styles.composerHit,
            { opacity: sending ? 0.4 : pressed ? 0.6 : 1 },
          ]}
        >
          <Animated.View style={{ transform: [{ rotate: plusRotation }] }}>
            <Ionicons name="add" size={28} color={colors.textSecondary} />
          </Animated.View>
        </Pressable>

        <View style={[styles.inputWrap, { backgroundColor: colors.track }]}>
          <TextInput
            accessibilityLabel={accessibilityLabel}
            value={draft}
            onChangeText={(value) => {
              setDictationError(null);
              onDraft(value);
            }}
            placeholder="Message"
            placeholderTextColor={colors.textMuted}
            maxLength={2000}
            returnKeyType="send"
            onFocus={onComposerFocus}
            onBlur={onComposerBlur}
            onSubmitEditing={() => {
              if (canSend) submitMessage();
            }}
            style={[styles.input, { color: colors.textPrimary }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop voice typing' : 'Start voice typing'}
            accessibilityState={{ busy: startingDictation, selected: listening }}
            disabled={sending || startingDictation}
            onPress={() => void toggleDictation()}
            hitSlop={4}
            style={({ pressed }) => [
              styles.dictationHit,
              listening && { backgroundColor: colors.surface },
              { opacity: sending ? 0.35 : pressed ? 0.6 : 1 },
            ]}
          >
            {startingDictation ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons
                name={listening ? 'mic' : 'mic-outline'}
                size={20}
                color={listening ? colors.accent : colors.textSecondary}
              />
            )}
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={!canSend}
          onPress={submitMessage}
          hitSlop={6}
          style={({ pressed }) => [
            styles.composerHit,
            { opacity: canSend ? (pressed ? 0.6 : 1) : 0.35 },
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="arrow-up" size={24} color={colors.accent} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function AttachmentAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.attachmentAction, pressed && styles.actionPressed]}
    >
      <View style={[styles.attachmentActionIcon, { backgroundColor: colors.track }]}>
        <Ionicons name={icon} size={21} color={colors.textPrimary} />
      </View>
      <AppText variant="micro" tone="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** What the composer is holding, with a way to drop it again. */
function AttachmentPreview({
  attachment,
  busy,
  onRemove,
}: {
  attachment: PickedAttachment;
  busy: boolean;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.previewRow}>
      <View style={[styles.preview, { backgroundColor: colors.surfaceRaised }]}>
        <Image
          source={{ uri: attachment.previewUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        {attachment.kind === 'video' ? (
          <View style={styles.previewBadge}>
            <Ionicons name="videocam" size={16} color="#FFFFFF" style={styles.onMediaGlyph} />
          </View>
        ) : null}
        {busy ? (
          <View style={[StyleSheet.absoluteFill, styles.previewBusy]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={styles.previewCopy}>
        <AppText variant="caption" weight="600" numberOfLines={1}>
          {attachment.kind === 'video' ? 'Video ready to send' : 'Photo ready to send'}
        </AppText>
        <AppText variant="micro" tone="muted" numberOfLines={1}>
          Add a message, or send it on its own.
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove attachment"
        disabled={busy}
        onPress={onRemove}
        hitSlop={8}
        style={({ pressed }) => [styles.composerHit, { opacity: busy ? 0.4 : pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  composerWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  composerHit: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    height: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: touchTarget / 2,
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.xs,
  },
  input: {
    ...type.body,
    flex: 1,
    height: touchTarget,
    paddingVertical: 0,
    ...Platform.select({
      web: { outlineStyle: 'none', outlineWidth: 0 } as object,
      default: {},
    }),
  },
  dictationHit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentMenuClip: {
    overflow: 'hidden',
  },
  attachmentMenu: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  attachmentAction: {
    width: 56,
    alignItems: 'center',
    gap: 3,
  },
  attachmentActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.6,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  preview: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBadge: {
    position: 'absolute',
    right: 3,
    bottom: 2,
  },
  previewBusy: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,9,12,0.55)',
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  onMediaGlyph: {
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
