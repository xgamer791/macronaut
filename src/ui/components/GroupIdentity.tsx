import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';
import { radius } from '@/ui/theme/tokens';

/** What a group's mark is drawn from: the name picks its gradient, the sport
 * its glyph. Anything that names a group can draw one. */
export interface GroupLook {
  name: string;
  sport?: string;
}

const GROUP_GRADIENTS = [
  ['#0D8B68', '#103B3B'],
  ['#4263EB', '#242C5B'],
  ['#DD7A23', '#71351D'],
  ['#8C5BD6', '#41275F'],
  ['#C44867', '#5C273B'],
  ['#1885A5', '#193F54'],
] as const;

/** A group's mark: its gradient tile and sport glyph, at any size. */
export function GroupIdentity({
  group,
  size,
  elevated = false,
}: {
  group: GroupLook;
  size: number;
  elevated?: boolean;
}) {
  const gradient = gradientFor(group);
  return (
    <LinearGradient
      colors={gradient}
      style={[
        styles.identity,
        {
          width: size,
          height: size,
          borderRadius: Math.max(radius.md, size * 0.28),
        },
        elevated && styles.identityElevated,
      ]}
    >
      <Ionicons name={iconFor(group.sport)} size={size * 0.48} color="#FFFFFF" />
    </LinearGradient>
  );
}

/** The one-line summary under a group's name. */
export function groupMeta(group: { sport?: string; location?: string; memberCount: number }) {
  return [
    group.sport,
    group.location,
    `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A stable gradient per group, from its name, so the mark never changes
 * between screens or renders. */
export function gradientFor(group: GroupLook): readonly [string, string] {
  let hash = 0;
  for (const char of group.name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return GROUP_GRADIENTS[Math.abs(hash) % GROUP_GRADIENTS.length] ?? GROUP_GRADIENTS[0];
}

export function iconFor(sport?: string): keyof typeof Ionicons.glyphMap {
  const value = sport?.toLocaleLowerCase() ?? '';
  if (/run|walk|hike|trail/.test(value)) return 'walk';
  if (/strength|lift|gym|crossfit/.test(value)) return 'barbell';
  if (/cycle|bike|spin/.test(value)) return 'bicycle';
  if (/swim|water/.test(value)) return 'water';
  if (/football|soccer/.test(value)) return 'football';
  if (/basketball/.test(value)) return 'basketball';
  if (/tennis/.test(value)) return 'tennisball';
  return 'fitness';
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  identityElevated: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.82)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
  },
});
