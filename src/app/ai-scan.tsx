import { CameraView, useCameraPermissions } from 'expo-camera';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyzeFoodPhoto, GrokFoodEstimate } from '@/services/food/grokVision';
import { useRepos } from '@/state/AppProvider';
import { keys, useSetting } from '@/state/queries';
import { goBackOrHome } from '@/utils/navigation';
import { AppText, Button, Card, Screen, ScreenHeader } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type ThemeColors } from '@/ui/theme/tokens';

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
  /** Web: separate pickers so Take opens the camera and Choose opens the library. */
  const takePhotoRef = useRef<HTMLInputElement | null>(null);
  const choosePhotoRef = useRef<HTMLInputElement | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<GrokFoodEstimate | null>(null);
  const [webCameraOn, setWebCameraOn] = useState(false);

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
              setWebCameraOn(false);
            }}
          />
        </Card>
      ) : Platform.OS === 'web' ? (
        webCameraOn ? (
          <WebLiveCamera
            busy={busy}
            colors={colors}
            onCancel={() => setWebCameraOn(false)}
            onCapture={(dataUrl) => {
              setWebCameraOn(false);
              void runAnalysis(dataUrl);
            }}
            onUnavailable={() => {
              setWebCameraOn(false);
              // Defer so unmount finishes before the system camera input opens.
              setTimeout(() => takePhotoRef.current?.click(), 0);
            }}
          />
        ) : (
          <Card style={{ gap: spacing.md }}>
            <AppText variant="body" weight="600">
              Take or upload a photo
            </AppText>
            <AppText variant="caption" tone="secondary">
              Snap with your camera or pick a clear plate photo (JPEG/PNG).
            </AppText>
            <Button
              title={busy ? 'Analyzing…' : 'Take photo'}
              onPress={() => {
                if (
                  typeof navigator !== 'undefined' &&
                  typeof navigator.mediaDevices?.getUserMedia === 'function'
                ) {
                  setWebCameraOn(true);
                  return;
                }
                takePhotoRef.current?.click();
              }}
              loading={busy}
              disabled={busy}
            />
            <Button
              title="Choose photo"
              variant="secondary"
              onPress={() => choosePhotoRef.current?.click()}
              disabled={busy}
            />
            {typeof document !== 'undefined' ? (
              <View style={{ height: 0, overflow: 'hidden' }}>
                {/* capture=environment opens the device camera on mobile browsers. */}
                <input
                  ref={(node) => {
                    takePhotoRef.current = node;
                  }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) onWebFile(file);
                    e.currentTarget.value = '';
                  }}
                />
                {/* No capture attribute — gallery / files only. */}
                <input
                  ref={(node) => {
                    choosePhotoRef.current = node;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/*"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) onWebFile(file);
                    e.currentTarget.value = '';
                  }}
                />
              </View>
            ) : null}
          </Card>
        )
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

/** In-page rear camera for web AI scan; falls back via onUnavailable. */
function WebLiveCamera({
  busy,
  colors,
  onCapture,
  onCancel,
  onUnavailable,
}: {
  busy: boolean;
  colors: ThemeColors;
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
  onUnavailable: () => void;
}) {
  const hostRef = useRef<View>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onCaptureRef = useRef(onCapture);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onCaptureRef.current = onCapture;
  });
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  });

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onUnavailableRef.current();
      return;
    }

    const video = document.createElement('video');
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    video.autoplay = true;
    Object.assign(video.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      position: 'absolute',
      inset: '0',
    });
    host.appendChild(video);
    videoRef.current = video;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play().catch(() => {});
      } catch {
        if (!cancelled) onUnavailableRef.current();
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      videoRef.current = null;
      video.remove();
    };
  }, []);

  function snap() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    onCaptureRef.current(canvas.toDataURL('image/jpeg', 0.7));
  }

  return (
    <View style={styles.cameraWrap}>
      <View ref={hostRef} style={[styles.camera, { backgroundColor: colors.surface }]} collapsable={false} />
      <View style={styles.webShutterRow}>
        <Button title="Cancel" variant="ghost" onPress={onCancel} disabled={busy} compact />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture food photo"
          disabled={busy}
          onPress={snap}
          style={[styles.shutter, { backgroundColor: colors.accent, opacity: busy ? 0.5 : 1 }]}
        >
          <Ionicons name="camera" size={28} color={colors.onAccent} />
        </Pressable>
        <View style={{ width: 72 }} />
      </View>
      {busy ? (
        <AppText variant="caption" tone="muted" align="center">
          Analyzing with Grok…
        </AppText>
      ) : (
        <AppText variant="caption" tone="muted" align="center">
          Point at your meal, then tap the shutter
        </AppText>
      )}
    </View>
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
    overflow: 'hidden',
  },
  shutterRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  webShutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  shutter: {
    width: touchTarget + 12,
    height: touchTarget + 12,
    borderRadius: (touchTarget + 12) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
