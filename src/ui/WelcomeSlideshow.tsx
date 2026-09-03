import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import {
  SESSION_WELCOME_INDEX,
  WELCOME_PHOTOS,
  WELCOME_PHOTO_FADE_MS,
  WELCOME_PHOTO_HOLD_MS,
} from '@/ui/welcomePhotos';

const LEN = WELCOME_PHOTOS.length;

/** Two stacked stills. The front layer dissolves so the next athlete is
 * already sitting underneath — no empty frame between photos. */
export function WelcomeSlideshow() {
  const start = SESSION_WELCOME_INDEX;
  const [indexA, setIndexA] = useState(start);
  const [indexB, setIndexB] = useState((start + 1) % LEN);
  const [opacityA] = useState(() => new Animated.Value(1));
  const showA = useRef(true);
  const indexARef = useRef(start);
  const indexBRef = useRef((start + 1) % LEN);

  useEffect(() => {
    let cancelled = false;
    let hold: ReturnType<typeof setTimeout> | undefined;
    let fade: Animated.CompositeAnimation | undefined;

    const dissolve = (toValue: number, onDone: () => void) => {
      fade = Animated.timing(opacityA, {
        toValue,
        duration: WELCOME_PHOTO_FADE_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      });
      fade.start(({ finished }) => {
        if (!finished || cancelled) return;
        onDone();
      });
    };

    const arm = () => {
      hold = setTimeout(() => {
        if (cancelled) return;
        if (showA.current) {
          dissolve(0, () => {
            showA.current = false;
            const next = (indexBRef.current + 1) % LEN;
            indexARef.current = next;
            setIndexA(next);
            arm();
          });
        } else {
          dissolve(1, () => {
            showA.current = true;
            const next = (indexARef.current + 1) % LEN;
            indexBRef.current = next;
            setIndexB(next);
            arm();
          });
        }
      }, WELCOME_PHOTO_HOLD_MS);
    };

    arm();
    return () => {
      cancelled = true;
      if (hold) clearTimeout(hold);
      fade?.stop();
    };
  }, [opacityA]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={WELCOME_PHOTOS[indexB]}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityA }]}>
        <Image
          source={WELCOME_PHOTOS[indexA]}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </Animated.View>
    </View>
  );
}
