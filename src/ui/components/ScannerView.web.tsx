import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { ScannerViewProps } from './ScannerView';

/** Web implementation of THE scanner engine: live getUserMedia preview with
 * continuous ZXing decoding. Works in mobile Safari/Chrome over HTTPS —
 * point the camera at a barcode and it detects automatically. */
export function ScannerView({ onCode, torch = false, onTorchSupport, onError, style }: ScannerViewProps) {
  const hostRef = useRef<View | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  });

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;

    const video = document.createElement('video');
    video.setAttribute('playsinline', 'true'); // required by iOS Safari
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

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
    ]);
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 120,
    });

    (async () => {
      try {
        // Rear camera preferred; ZXing picks the stream and decodes frames.
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
          video,
          (result) => {
            if (result) onCodeRef.current(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        const stream = video.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        onTorchSupport?.(Boolean(caps?.torch));
      } catch (err) {
        const name = (err as Error).name;
        onError?.(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      trackRef.current = null;
      video.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Torch toggling via track constraints (Android Chrome; iOS lacks support).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
    if (!caps?.torch) return;
    track
      .applyConstraints({ advanced: [{ torch } as MediaTrackConstraintSet] })
      .catch(() => {});
  }, [torch]);

  return <View ref={hostRef} style={[{ flex: 1, overflow: 'hidden' }, style]} />;
}
