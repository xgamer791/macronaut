import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

/** THE barcode scanning engine — every scanner surface in the app renders
 * this component. Native implementation: expo-camera with continuous
 * detection of common retail formats. (Web implementation: ScannerView.web.tsx,
 * ZXing over getUserMedia.) */
export interface ScannerViewProps {
  /** Called for every decoded barcode; caller handles debouncing/locking. */
  onCode: (code: string) => void;
  torch?: boolean;
  /** Reports whether a torch/flash is available on this device. */
  onTorchSupport?: (supported: boolean) => void;
  /** Camera/permission failures ('denied' | 'unavailable'). */
  onError?: (kind: 'denied' | 'unavailable') => void;
  style?: StyleProp<ViewStyle>;
}

export function ScannerView({ onCode, torch = false, onTorchSupport, onError, style }: ScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    onTorchSupport?.(true); // expo-camera exposes torch on all camera devices
  }, [onTorchSupport]);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      if (permission.canAskAgain) requestPermission();
      else onError?.('denied');
    }
  }, [permission, requestPermission, onError]);

  if (!permission?.granted) return null;

  return (
    <CameraView
      style={[{ flex: 1 }, style]}
      facing="back"
      enableTorch={torch}
      barcodeScannerSettings={{
        barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14'],
      }}
      onBarcodeScanned={({ data }) => {
        if (data) onCode(data);
      }}
    />
  );
}
