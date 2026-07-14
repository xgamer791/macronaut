import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { TextField } from './TextField';

export interface BarcodeScanSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called once per accepted code (camera or manual). */
  onCode: (code: string) => void;
  busy?: boolean;
}

/** The one scanning surface used everywhere a barcode can be entered:
 * live camera on iOS/Android, manual entry always, demo code on web. */
export function BarcodeScanSheet({ visible, onClose, onCode, busy }: BarcodeScanSheetProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const lock = useRef(false);
  const isWeb = Platform.OS === 'web';

  function submit(code: string) {
    if (lock.current || !code.trim()) return;
    lock.current = true;
    onCode(code.trim());
    setTimeout(() => {
      lock.current = false;
    }, 1500);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Scan a barcode">
      {!isWeb && permission?.granted ? (
        <View style={{ borderRadius: radius.md, overflow: 'hidden', height: 240 }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
            }}
            onBarcodeScanned={({ data }) => submit(data)}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '22%',
              left: '12%',
              right: '12%',
              bottom: '22%',
              borderWidth: 2,
              borderColor: colors.accent,
              borderRadius: radius.md,
            }}
          />
        </View>
      ) : null}

      {!isWeb && permission !== null && !permission.granted ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" tone="secondary">
            Macronaut uses the camera only to read food barcodes. Nothing is recorded or uploaded.
          </AppText>
          {permission.canAskAgain ? (
            <Button title="Allow camera" onPress={() => requestPermission()} />
          ) : (
            <AppText variant="caption" tone="danger">
              Camera permission was declined — enable it in system Settings, or type the code below.
            </AppText>
          )}
        </View>
      ) : null}

      {isWeb ? (
        <Button
          title="Try demo barcode (Nutella)"
          variant="secondary"
          onPress={() => submit('3017620422003')}
        />
      ) : null}

      <TextField
        label="Or enter the barcode manually"
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
