import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { ScannerView } from './ScannerView';
import { Sheet } from './Sheet';
import { TextField } from './TextField';

export interface BarcodeScanSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called once per accepted code (live camera or manual fallback). */
  onCode: (code: string) => void;
  busy?: boolean;
}

/** In-form barcode capture (custom food, editors): the SAME live ScannerView
 * engine as the full-screen scanner, presented in a sheet. Detection is
 * automatic; manual entry exists only as a fallback for damaged codes. */
export function BarcodeScanSheet({ visible, onClose, onCode, busy }: BarcodeScanSheetProps) {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<'denied' | 'unavailable' | null>(null);
  const lock = useRef(false);

  function submit(code: string) {
    if (lock.current || !code.trim()) return;
    lock.current = true;
    if (Platform.OS === 'web') {
      (navigator as Navigator & { vibrate?: (ms: number) => void }).vibrate?.(80);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    onCode(code.trim());
    setTimeout(() => {
      lock.current = false;
    }, 1500);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Scan barcode">
      {!cameraError ? (
        <View style={{ borderRadius: radius.md, overflow: 'hidden', height: 260, backgroundColor: '#000' }}>
          <ScannerView onCode={submit} onError={setCameraError} />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '20%',
              left: '10%',
              right: '10%',
              bottom: '20%',
              borderWidth: 2,
              borderColor: '#1FC98B',
              borderRadius: radius.md,
            }}
          />
          <AppText
            variant="micro"
            align="center"
            style={{ position: 'absolute', bottom: 8, left: 0, right: 0, color: '#fff' }}
          >
            Point the camera at the barcode — it scans automatically
          </AppText>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" tone="secondary">
            {cameraError === 'denied'
              ? 'Camera access was declined. Macronaut uses it only to read barcodes — enable it in your browser or system settings, or type the code below.'
              : 'No camera found on this device — type the barcode below.'}
          </AppText>
        </View>
      )}

      <TextField
        label="Manual fallback"
        value={manualCode}
        onChangeText={setManualCode}
        placeholder="e.g. 0123456789012"
        keyboardType="number-pad"
        inputMode="numeric"
      />
      <Button
        title="Look up"
        onPress={() => submit(manualCode)}
        disabled={manualCode.trim().length < 6}
        loading={busy}
      />
    </Sheet>
  );
}
