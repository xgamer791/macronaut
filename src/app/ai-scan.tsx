import { CameraView, useCameraPermissions } from 'expo-camera';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyzeFoodPhoto, GrokFoodEstimate } from '@/services/food/grokVision';
import { useRepos } from '@/state/AppProvider';
import { keys, useSetting } from '@/state/queries';
import { goBackOrHome } from '@/utils/navigation';
import { AppText, Button, Card, Screen, ScreenHeader } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';

/**
 * Paid AI food scan — photo → Grok vision → custom food → confirm & log.
 * Unlocked by a user-supplied Grok API key in Settings (owner/preview use for now).
 */
export default function AiScanScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { food } = useRepos();
  const qc = useQueryClient();
  const apiKey = useSetting<string>('grokApiKey', '');
  const cameraRef = useRef<CameraView>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<GrokFoodEstimate | null>(null);

  const keyReady = (apiKey.data ?? '').trim().length > 0;

  async function runAnalysis(dataUrl: string) {
    setBusy(true);
    setError(null);
    setEstimate(null);
    try {
      const result = await analyzeFoodPhoto({
        apiKey: apiKey.data ?? '',
        dataUrl,
      });
      setEstimate(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI scan failed');
    } finally {
      setBusy(false);
    }
  }

  async function captureNative() {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.7,
        base64: true,
        skipProcessing: true,
      });
      if (!photo?.base64) {
        setError('Could not capture a photo');
        return;
      }
      const mime = photo.uri?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      await runAnalysis(`data:${mime};base64,${photo.base64}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Camera capture failed');
    }
  }

  function onWebFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      if (dataUrl.startsWith('data:image/')) void runAnalysis(dataUrl);
      else setError('Please choose a JPEG or PNG photo');
    };
    reader.onerror = () => setError('Could not read that image');
    reader.readAsDataURL(file);
  }

  async function saveAndOpen() {
    if (!estimate) return;
    setBusy(true);
    try {
      const created = await food.addCustomFood({
        name: estimate.name,
        brand: estimate.brand,
        servingQty: estimate.servingQty,
        servingUnit: estimate.servingUnit,
        gramsPerServing: estimate.gramsPerServing,
        nutrition: estimate.nutrition,
        notes: [
          estimate.notes,
          `AI food scan · confidence ${Math.round(estimate.confidence * 100)}%`,
        ]
          .filter(Boolean)
          .join(' · '),
        favorite: false,
        sourceProvider: 'grok',
        sourceId: 'ai-scan',
      });
      qc.invalidateQueries({ queryKey: keys.customFoods('') });
      router.replace({
        pathname: '/food/[provider]/[id]',
        params: { provider: 'custom', id: created.id },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save food');
      setBusy(false);
    }
  }

  if (apiKey.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="AI food scan" />
        <AppText variant="caption" tone="muted" align="center">
          Loading…
        </AppText>
      </Screen>
    );
  }

  if (!keyReady) {
    return (
      <Screen>
        <ScreenHeader title="AI food scan" />
        <Card style={{ gap: spacing.md }}>
          <AppText variant="heading" weight="600" display>
            Grok key required
          </AppText>
          <AppText variant="caption" tone="secondary">
            AI food scan is a paid feature. For now it runs with your personal xAI Grok API key
            stored only on this device.
          </AppText>
          <Button
            title="Add Grok API key"
            onPress={() => {
              goBackOrHome(router);
              setTimeout(() => router.push('/settings'), 50);
            }}
          />
          <Button title="Cancel" variant="ghost" onPress={() => goBackOrHome(router)} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="AI food scan" />
      <AppText variant="caption" tone="secondary">
        Snap a meal — Grok estimates the food, weight, and calories. Review before logging.
      </AppText>

      {error ? (
        <Card>
          <AppText variant="caption" tone="danger">
            {error}
          </AppText>
        </Card>
      ) : null}

      {estimate ? (
        <Card style={{ gap: spacing.md }}>
          <AppText variant="heading" weight="600" display>
            {estimate.name}
          </AppText>
          {estimate.brand ? (
            <AppText variant="caption" tone="secondary">
              {estimate.brand}
            </AppText>
          ) : null}
          <AppText variant="body">
            {Math.round(estimate.nutrition.calories)} kcal · {estimate.servingQty}{' '}
            {estimate.servingUnit}
            {estimate.gramsPerServing ? ` (~${Math.round(estimate.gramsPerServing)} g)` : ''}
          </AppText>
          <AppText variant="caption" tone="muted">
            P {estimate.nutrition.protein ?? '—'} · C {estimate.nutrition.carbs ?? '—'} · F{' '}
            {estimate.nutrition.fat ?? '—'}
            {estimate.nutrition.fiber !== undefined ? ` · Fiber ${estimate.nutrition.fiber}` : ''}
          </AppText>
          <AppText variant="micro" tone="muted">
            Confidence {Math.round(estimate.confidence * 100)}%
            {estimate.notes ? ` · ${estimate.notes}` : ''}
          </AppText>
          <Button title="Save & review portion" onPress={saveAndOpen} loading={busy} />
          <Button
            title="Retake"
            variant="secondary"
            onPress={() => {
              setEstimate(null);
              setError(null);
            }}
          />
        </Card>
      ) : Platform.OS === 'web' ? (
        <Card style={{ gap: spacing.md }}>
          <AppText variant="body" weight="600">
            Take or upload a photo
          </AppText>
          <AppText variant="caption" tone="secondary">
            Use your camera or pick a clear plate photo (JPEG/PNG).
          </AppText>
          <Button
            title={busy ? 'Analyzing…' : 'Choose photo'}
            onPress={() => fileRef.current?.click()}
            loading={busy}
            disabled={busy}
          />
          {typeof document !== 'undefined' ? (
            <View style={{ height: 0, overflow: 'hidden' }}>
              {/* Hidden web file picker — capture prefers the rear camera when available. */}
              <input
                ref={(node) => {
                  fileRef.current = node;
                }}
                type="file"
                accept="image/jpeg,image/png,image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) onWebFile(file);
                  e.currentTarget.value = '';
                }}
              />
            </View>
          ) : null}
        </Card>
      ) : (
        <View style={styles.cameraWrap}>
          {!permission?.granted ? (
            <Card style={{ gap: spacing.md }}>
              <AppText variant="caption" tone="secondary">
                Camera access is needed to photograph your food.
              </AppText>
              <Button
                title="Enable camera"
                onPress={async () => {
                  const res = await requestPermission();
                  if (!res.granted) setError('Camera permission denied');
                }}
              />
            </Card>
          ) : (
            <>
              <CameraView ref={cameraRef} style={styles.camera} facing="back" />
              <View style={styles.shutterRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Capture food photo"
                  disabled={busy}
                  onPress={() => void captureNative()}
                  style={[
                    styles.shutter,
                    { backgroundColor: colors.accent, opacity: busy ? 0.5 : 1 },
                  ]}
                >
                  <Ionicons name="camera" size={28} color={colors.onAccent} />
                </Pressable>
              </View>
              {busy ? (
                <AppText variant="caption" tone="muted" align="center">
                  Analyzing with Grok…
                </AppText>
              ) : null}
            </>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    flex: 1,
    minHeight: 360,
    borderRadius: radius.lg,
    overflow: 'hidden',
    gap: spacing.md,
  },
  camera: {
    flex: 1,
    minHeight: 320,
    borderRadius: radius.lg,
  },
  shutterRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  shutter: {
    width: touchTarget + 12,
    height: touchTarget + 12,
    borderRadius: (touchTarget + 12) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
