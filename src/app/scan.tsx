import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { ProviderFood } from '@/services/food/types';
import { useFoodSearchService } from '@/state/foodSearch';
import { goBackOrHome } from '@/utils/navigation';
import {
  AppText,
  Button,
  EmptyState,
  ListRow,
  ScannerOverlay,
  ScannerView,
  Sheet,
  TextField,
} from '@/ui/components';
import { spacing } from '@/ui/theme/tokens';

type ScanState = 'scanning' | 'detected' | 'success';

/** Full-screen live barcode scanner. Detection is automatic and continuous;
 * a successful scan vibrates, plays the confirmation and opens the product.
 * Lookup fans out across every configured provider before giving up. */
export default function ScanScreen() {
  const router = useRouter();
  const svc = useFoodSearchService();

  const [state, setState] = useState<ScanState>('scanning');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraError, setCameraError] = useState<'denied' | 'unavailable' | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [offline, setOffline] = useState(false);
  const [candidates, setCandidates] = useState<ProviderFood[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const lock = useRef(false);

  function buzz() {
    if (Platform.OS === 'web') {
      (navigator as Navigator & { vibrate?: (ms: number) => void }).vibrate?.(80);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }

  async function handleCode(code: string) {
    const clean = code.trim();
    if (lock.current || !clean) return;
    lock.current = true; // duplicate-scan guard — released only on failure paths
    setLastCode(clean);
    setNotFound(false);
    setOffline(false);
    buzz();
    setState('detected');

    const result = await svc.lookupBarcode(clean);

    if (result.custom) {
      setState('success');
      setTimeout(() => {
        router.replace({ pathname: '/food/[provider]/[id]', params: { provider: 'custom', id: result.custom! } });
      }, 450);
      return;
    }
    if (result.food) {
      if (result.candidates && result.candidates.length > 0) {
        setCandidates([result.food, ...result.candidates]);
        setState('scanning');
        return; // sheet open; lock stays until choice or dismiss
      }
      setState('success');
      const f = result.food;
      setTimeout(() => {
        router.replace({ pathname: '/food/[provider]/[id]', params: { provider: f.provider, id: f.id } });
      }, 450);
      return;
    }

    // Nothing matched across ALL providers.
    setOffline(result.offline);
    setNotFound(!result.offline);
    setState('scanning');
    setTimeout(() => {
      lock.current = false;
    }, 2000);
  }

  const scannerActive = !cameraError && candidates.length === 0 && !notFound && !offline;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {scannerActive ? (
        <>
          <ScannerView
            onCode={handleCode}
            torch={torchOn}
            onTorchSupport={setTorchSupported}
            onError={setCameraError}
          />
          <ScannerOverlay
            state={state}
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={() => setTorchOn((t) => !t)}
            onCancel={() => goBackOrHome(router)}
          />
          <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' }}>
            <Button
              title="Enter code manually"
              variant="ghost"
              compact
              onPress={() => setManualOpen(true)}
            />
          </View>
        </>
      ) : null}

      {cameraError ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <AppText variant="heading" weight="600" align="center" style={{ color: '#fff' }}>
            {cameraError === 'denied' ? 'Camera access needed' : 'Camera unavailable'}
          </AppText>
          <AppText variant="caption" align="center" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {cameraError === 'denied'
              ? 'Macronaut uses the camera only to read food barcodes — nothing is recorded or uploaded. Enable camera access in your browser or system settings, then try again.'
              : 'No camera was found on this device. You can still enter the barcode number below.'}
          </AppText>
          <Button title="Enter code manually" variant="secondary" onPress={() => setManualOpen(true)} />
          <Button title="Cancel" variant="ghost" onPress={() => goBackOrHome(router)} />
        </View>
      ) : null}

      {notFound && lastCode ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
          <EmptyState
            title="Barcode not found"
            body={`${lastCode} isn't in USDA or Open Food Facts yet. Create it once and it scans instantly next time.`}
            actionTitle="Create custom food with this barcode"
            onAction={() => router.replace({ pathname: '/custom-food', params: { barcode: lastCode } })}
          />
          <Button
            title="Scan again"
            variant="secondary"
            onPress={() => {
              setNotFound(false);
              lock.current = false;
            }}
          />
          <Button title="Cancel" variant="ghost" onPress={() => goBackOrHome(router)} />
        </View>
      ) : null}

      {offline ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
          <AppText variant="heading" weight="600" align="center" style={{ color: '#fff' }}>
            You&apos;re offline
          </AppText>
          <AppText variant="caption" align="center" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Barcode lookup needs an internet connection. Previously scanned foods still work
            offline.
          </AppText>
          <Button
            title="Try again"
            variant="secondary"
            onPress={() => {
              setOffline(false);
              lock.current = false;
            }}
          />
          <Button title="Cancel" variant="ghost" onPress={() => goBackOrHome(router)} />
        </View>
      ) : null}

      {/* Multiple plausible products for one code */}
      <Sheet
        visible={candidates.length > 0}
        onClose={() => {
          setCandidates([]);
          lock.current = false;
        }}
        title="Select the right product"
      >
        {candidates.map((f, i) => (
          <ListRow
            key={`${f.provider}:${f.id}`}
            title={i === 0 ? `${f.name} · Best match` : f.name}
            subtitle={[f.brand, f.provider === 'off' ? 'Open Food Facts' : 'USDA'].filter(Boolean).join(' · ')}
            value={
              f.nutritionPerServing?.calories !== undefined
                ? `${Math.round(f.nutritionPerServing.calories)} kcal`
                : undefined
            }
            onPress={() => {
              setCandidates([]);
              router.replace({ pathname: '/food/[provider]/[id]', params: { provider: f.provider, id: f.id } });
            }}
          />
        ))}
        <Button
          title="None of these — create custom food"
          variant="secondary"
          onPress={() => {
            setCandidates([]);
            router.replace({ pathname: '/custom-food', params: { barcode: lastCode ?? '' } });
          }}
        />
      </Sheet>

      {/* Manual fallback — for damaged barcodes, not the normal path */}
      <Sheet visible={manualOpen} onClose={() => setManualOpen(false)} title="Enter barcode">
        <TextField
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="e.g. 0123456789012"
          keyboardType="number-pad"
          inputMode="numeric"
          autoFocus
        />
        <Button
          title="Look up"
          disabled={manualCode.trim().length < 6}
          onPress={() => {
            setManualOpen(false);
            handleCode(manualCode);
          }}
        />
      </Sheet>
    </View>
  );
}
