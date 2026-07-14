import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useFoodSearchService } from '@/state/foodSearch';
import { goBackOrHome } from '@/utils/navigation';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ListRow,
  Screen,
  Sheet,
  TextField,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { ProviderFood } from '@/services/food/types';

/** Barcode scanning: camera on native; manual entry + demo scan on web
 * (browser camera barcode decoding isn't supported by expo-camera). */
export default function ScanScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const svc = useFoodSearchService();
  const [permission, requestPermission] = useCameraPermissions();

  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'looking' | 'unknown' | 'offline'>('idle');
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ProviderFood[]>([]);
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  // Lock prevents rapid repeated scans of the same code.
  const scanLock = useRef(false);

  const isWeb = Platform.OS === 'web';

  async function handleCode(code: string) {
    if (scanLock.current || !code.trim()) return;
    scanLock.current = true;
    setLastCode(code);
    setStatus('looking');
    try {
      const result = await svc.lookupBarcode(code.trim());
      if (result.custom) {
        router.replace({ pathname: '/food/[provider]/[id]', params: { provider: 'custom', id: result.custom } });
        return;
      }
      if (result.food) {
        if (result.candidates && result.candidates.length > 0) {
          // Best match first, but let the user pick another.
          setCandidates([result.food, ...result.candidates]);
          setCandidatesOpen(true);
          setStatus('idle');
        } else {
          router.replace({
            pathname: '/food/[provider]/[id]',
            params: { provider: result.food.provider, id: result.food.id },
          });
        }
        return;
      }
      if (result.offline) {
        setStatus('offline');
        return;
      }
      // Unknown barcode: offer text-search candidates for manual selection.
      const search = await svc.search(code.trim(), { limit: 6 });
      if (search.foods.filter((f) => f.provider !== 'local').length > 0) {
        setCandidates(search.foods.filter((f) => f.provider !== 'local'));
        setCandidatesOpen(true);
        setStatus('idle');
      } else {
        setStatus('unknown');
      }
    } finally {
      // Release the lock after a pause so a still-visible barcode doesn't
      // instantly re-trigger.
      setTimeout(() => {
        scanLock.current = false;
      }, 1500);
    }
  }

  const needsPermission = !isWeb && permission !== null && !permission.granted;

  return (
    <Screen>
      <AppText variant="title" weight="600" display>
        Scan a barcode
      </AppText>

      {!isWeb && permission?.granted ? (
        <View style={{ borderRadius: radius.lg, overflow: 'hidden', height: 320 }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
            }}
            onBarcodeScanned={({ data }) => handleCode(data)}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '25%',
              left: '15%',
              right: '15%',
              bottom: '25%',
              borderWidth: 2,
              borderColor: colors.accent,
              borderRadius: radius.md,
            }}
          />
          <AppText
            variant="caption"
            align="center"
            style={{ position: 'absolute', bottom: 12, left: 0, right: 0, color: '#fff' }}
          >
            Line the barcode up inside the frame
          </AppText>
        </View>
      ) : null}

      {needsPermission ? (
        <Card style={{ gap: spacing.md }}>
          <AppText variant="body" weight="600">
            Camera access needed
          </AppText>
          <AppText variant="caption" tone="secondary">
            Macronaut uses the camera only to read food barcodes so you can log packaged foods
            quickly. Nothing is recorded or uploaded.
          </AppText>
          {permission?.canAskAgain ? (
            <Button title="Allow camera" onPress={() => requestPermission()} />
          ) : (
            <AppText variant="caption" tone="danger">
              Camera permission was declined. Enable it in system Settings, or type the barcode
              below.
            </AppText>
          )}
        </Card>
      ) : null}

      {isWeb ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="caption" tone="secondary">
            Camera barcode scanning works in the iOS app. On the web, type the barcode number below
            — or try the demo barcode.
          </AppText>
          <Button title="Try demo barcode (Nutella)" variant="secondary" onPress={() => handleCode('3017620422003')} />
        </Card>
      ) : null}

      <Card style={{ gap: spacing.md }}>
        <TextField
          label="Enter barcode manually"
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="e.g. 0123456789012"
          keyboardType="number-pad"
          inputMode="numeric"
        />
        <Button
          title="Look up"
          onPress={() => handleCode(manualCode)}
          disabled={manualCode.trim().length < 6}
          loading={status === 'looking'}
        />
      </Card>

      {status === 'unknown' && lastCode ? (
        <EmptyState
          title="Barcode not found"
          body={`No food matches ${lastCode} in USDA or Open Food Facts. Create it once and it scans instantly next time.`}
          actionTitle="Create custom food with this barcode"
          onAction={() =>
            router.replace({ pathname: '/custom-food', params: { barcode: lastCode } })
          }
        />
      ) : null}

      {status === 'offline' ? (
        <Card>
          <AppText variant="caption" tone="secondary">
            Barcode lookup needs an internet connection. Previously scanned foods still work
            offline — or create a custom food for this barcode.
          </AppText>
        </Card>
      ) : null}

      <Button title="Cancel" variant="ghost" onPress={() => goBackOrHome(router)} />

      {/* Multiple possible matches */}
      <Sheet visible={candidatesOpen} onClose={() => setCandidatesOpen(false)} title="Select the right product">
        {candidates.map((f) => (
          <ListRow
            key={`${f.provider}:${f.id}`}
            title={f.name}
            subtitle={[f.brand, f.provider.toUpperCase()].filter(Boolean).join(' · ')}
            value={
              f.nutritionPerServing?.calories !== undefined
                ? `${Math.round(f.nutritionPerServing.calories)} kcal`
                : undefined
            }
            onPress={() => {
              setCandidatesOpen(false);
              router.replace({
                pathname: '/food/[provider]/[id]',
                params: { provider: f.provider, id: f.id },
              });
            }}
          />
        ))}
        <Button
          title="None of these — create custom food"
          variant="secondary"
          onPress={() => {
            setCandidatesOpen(false);
            router.replace({ pathname: '/custom-food', params: { barcode: lastCode ?? '' } });
          }}
        />
      </Sheet>
    </Screen>
  );
}
