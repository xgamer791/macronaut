import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/**
 * A clip inside a message bubble. Muted and paused until it is tapped, with
 * the platform's own controls — a chat thread that autoplays sound is a
 * chat thread nobody scrolls twice.
 */
export function ChatVideo({
  uri,
  style,
  accessibilityLabel,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.muted = false;
    instance.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={[styles.video, style]}
      contentFit="cover"
      nativeControls
      fullscreenOptions={{ enable: true }}
      accessibilityLabel={accessibilityLabel ?? 'Video'}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: '100%',
  },
});
