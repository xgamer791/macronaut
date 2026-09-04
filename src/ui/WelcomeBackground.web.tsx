import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image as RNImage, StyleSheet, View } from 'react-native';
import { WelcomeSlideshow } from '@/ui/WelcomeSlideshow';

const LOOP = require('../../assets/video/welcome-loop.mp4');
const POSTER = require('../../assets/video/welcome-poster.jpg');

let sharedVideo: HTMLVideoElement | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
const hosts: HTMLElement[] = [];

function uriOf(mod: unknown): string | undefined {
  if (typeof mod === 'string') return mod;
  if (mod && typeof mod === 'object') {
    const rec = mod as { uri?: string; default?: unknown };
    if (typeof rec.uri === 'string') return rec.uri;
    if (rec.default != null) return uriOf(rec.default);
  }
  return RNImage.resolveAssetSource(mod as number)?.uri;
}

function resumeWelcomeVideo() {
  if (hosts.length === 0 || !sharedVideo) return;
  void sharedVideo.play().catch(() => {});
}

function attachToTop() {
  const video = sharedVideo;
  const top = hosts[hosts.length - 1];
  if (!video || !top) return;
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (video.parentElement !== top) top.appendChild(video);
  resumeWelcomeVideo();
}

function claimHost(host: HTMLElement) {
  const i = hosts.indexOf(host);
  if (i >= 0) hosts.splice(i, 1);
  hosts.push(host);
  attachToTop();
}

function releaseHost(host: HTMLElement) {
  const i = hosts.indexOf(host);
  if (i >= 0) hosts.splice(i, 1);
  if (hosts.length > 0) {
    attachToTop();
    return;
  }
  if (sharedVideo?.parentElement === host) sharedVideo.remove();
  releaseTimer = setTimeout(() => {
    if (hosts.length === 0) sharedVideo?.pause();
  }, 400);
}

function acquireWelcomeVideo(src: string, poster: string | undefined): HTMLVideoElement {
  if (sharedVideo) return sharedVideo;

  const video = document.createElement('video');
  video.src = src;
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
  video.addEventListener('pause', resumeWelcomeVideo);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeWelcomeVideo();
  });
  sharedVideo = video;
  return video;
}

/** Web: muted Seedance loop. One shared <video> is handed between create-account
 * screens so back/forward never restarts or leaves it paused. Poster is the
 * first jog frame. If the file fails to load, the stills take over. */
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

    const video = acquireWelcomeVideo(src, uriOf(POSTER));
    const fail = () => setUseStills(true);
    video.addEventListener('error', fail);
    claimHost(host);
    return () => {
      video.removeEventListener('error', fail);
      releaseHost(host);
    };
  }, [useStills]);

  useFocusEffect(
    useCallback(() => {
      if (useStills) return;
      const host = hostRef.current as unknown as HTMLElement | null;
      if (host) claimHost(host);
    }, [useStills]),
  );

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
