import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Image as RNImage, StyleSheet, View } from 'react-native';
import { WelcomeSlideshow } from '@/ui/WelcomeSlideshow';

const LOOP = require('../../assets/video/welcome-loop.mp4');
const POSTER = require('../../assets/video/welcome-poster.jpg');

function uriOf(mod: unknown): string | undefined {
  if (typeof mod === 'string') return mod;
  if (mod && typeof mod === 'object') {
    const rec = mod as { uri?: string; default?: unknown };
    if (typeof rec.uri === 'string') return rec.uri;
    if (rec.default != null) return uriOf(rec.default);
  }
  return RNImage.resolveAssetSource(mod as number)?.uri;
}

/** Web: muted Seedance loop. Poster is the first jog frame so the cut
 * from launch still to motion is invisible. If the file fails to load,
 * the stills stay on disk and take over. */
export function WelcomeBackground() {
  const hostRef = useRef<View | null>(null);
  const [useStills, setUseStills] = useState(false);

  useEffect(() => {
    if (useStills) return;
    const host = hostRef.current as unknown as HTMLElement | null;
    const src = uriOf(LOOP);
    if (!host || !src) {
      setUseStills(true);
      return;
    }

    const video = document.createElement('video');
    video.src = src;
    const poster = uriOf(POSTER);
    if (poster) video.poster = poster;
    video.autoplay = true;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.controls = false;
    video.disablePictureInPicture = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('disablepictureinpicture', 'true');
    Object.assign(video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      // Video compositor layers on iOS sit above later siblings and eat taps
      // unless this is set — pointer-events is not inherited.
      pointerEvents: 'none',
    });

    const fail = () => setUseStills(true);
    video.addEventListener('error', fail);
    host.appendChild(video);
    void video.play().catch(() => {});

    return () => {
      video.removeEventListener('error', fail);
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    };
  }, [useStills]);

  if (useStills) return <WelcomeSlideshow />;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={POSTER} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View ref={hostRef} style={StyleSheet.absoluteFill} />
    </View>
  );
}
