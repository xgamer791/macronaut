import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { GymCandidate, MyGym } from '@/repositories/gymRepo';
import { useClaimGym, useGeocode, useGymSearchAvailable, useSearchGyms } from '@/state/queries';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { metersToMiles } from '../../../convex/lib/geo';
import { AppText } from './AppText';
import { Button } from './Button';
import { TextField } from './TextField';

const QUERY_MAX = 60;
const ADDRESS_MAX = 120;

interface Anchor {
  lat: number;
  lng: number;
  label: string;
}

export interface HomeGymPickerProps {
  /** The button that saves the pick — "Finish" in onboarding, "Save" later. */
  confirmLabel: string;
  /** Called once the gym is saved (and the group joined, if asked). */
  onDone?: (result: MyGym) => void;
  /** Offered as a quiet secondary action when present. */
  onSkip?: () => void;
  /** Disables every action while the host is busy with its own save. */
  busy?: boolean;
}

/**
 * Find a home gym: an anchor (the phone's location, or a typed address), the
 * gym's name, every match within seven miles to pick from, and a default-on
 * choice to join everyone who trains there. Searches run only on submit —
 * each one is a paid request — and nothing here ever sees the places key.
 */
export function HomeGymPicker({ confirmLabel, onDone, onSkip, busy = false }: HomeGymPickerProps) {
  const { colors } = useTheme();
  const available = useGymSearchAvailable();
  const geocode = useGeocode();
  const search = useSearchGyms();
  const claim = useClaimGym();

  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GymCandidate[] | null>(null);
  const [selected, setSelected] = useState<GymCandidate | null>(null);
  const [joinGroup, setJoinGroup] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = busy || locating || geocode.isPending || search.isPending || claim.isPending;

  async function locateMe() {
    setError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Location was not allowed — type an address instead.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setAnchor({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: 'Your location',
      });
      setResults(null);
      setSelected(null);
    } catch {
      setError("Couldn't get your location — type an address instead.");
    } finally {
      setLocating(false);
    }
  }

  async function findAddress() {
    const wanted = address.trim();
    if (!wanted) return;
    setError(null);
    try {
      const point = await geocode.mutateAsync(wanted);
      setAnchor(point);
      setResults(null);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find that address.');
    }
  }

  async function runSearch() {
    const wanted = query.trim();
    if (!anchor || !wanted) return;
    setError(null);
    setSelected(null);
    try {
      const found = await search.mutateAsync({ query: wanted, lat: anchor.lat, lng: anchor.lng });
      setResults(found);
    } catch (e) {
      setResults(null);
      setError(e instanceof Error ? e.message : 'Gym search failed.');
    }
  }

  async function save() {
    if (!selected) return;
    setError(null);
    try {
      const result = await claim.mutateAsync({ gymId: selected.id, joinGroup });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your home gym.');
    }
  }

  if (available.data === false) {
    return (
      <View style={styles.stack}>
        <Panel>
          <AppText variant="body" weight="600">
            Gym search isn’t set up yet
          </AppText>
          <AppText variant="caption" tone="secondary">
            You can add your home gym later from Settings once it is.
          </AppText>
        </Panel>
        {onSkip ? <Button title="Continue" onPress={onSkip} disabled={busy} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Panel>
        <AppText variant="micro" weight="600" style={{ color: colors.textMuted }}>
          NEAR
        </AppText>
        <View style={styles.anchorRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use my location"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={() => void locateMe()}
            style={({ pressed }) => [
              styles.locate,
              {
                backgroundColor:
                  anchor?.label === 'Your location' ? colors.accent : colors.surfaceRaised,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Ionicons
                name="navigate-outline"
                size={18}
                color={anchor?.label === 'Your location' ? colors.onAccent : colors.textPrimary}
              />
            )}
            <AppText
              variant="caption"
              weight="600"
              style={{
                color: anchor?.label === 'Your location' ? colors.onAccent : colors.textPrimary,
              }}
            >
              Use my location
            </AppText>
          </Pressable>
          <AppText variant="caption" tone="muted">
            or
          </AppText>
        </View>
        <View style={styles.addressRow}>
          <View style={styles.grow}>
            <TextField
              placeholder="A rough address or city"
              value={address}
              onChangeText={setAddress}
              maxLength={ADDRESS_MAX}
              autoCapitalize="words"
              returnKeyType="search"
              onSubmitEditing={() => void findAddress()}
              editable={!pending}
            />
          </View>
          <Button
            title="Find"
            variant="secondary"
            compact
            loading={geocode.isPending}
            disabled={pending || !address.trim()}
            onPress={() => void findAddress()}
          />
        </View>
        {anchor ? (
          <View style={styles.anchorLine}>
            <Ionicons name="location-outline" size={14} color={colors.accent} />
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.grow}>
              Searching within 7 miles of {anchor.label}
            </AppText>
          </View>
        ) : null}
      </Panel>

      <Panel>
        <AppText variant="micro" weight="600" style={{ color: colors.textMuted }}>
          YOUR GYM
        </AppText>
        <View style={styles.addressRow}>
          <View style={styles.grow}>
            <TextField
              placeholder="Gold's, Planet Fitness, Life Time…"
              value={query}
              onChangeText={setQuery}
              maxLength={QUERY_MAX}
              autoCapitalize="words"
              returnKeyType="search"
              onSubmitEditing={() => void runSearch()}
              editable={!pending}
            />
          </View>
          <Button
            title="Search"
            compact
            loading={search.isPending}
            disabled={pending || !anchor || !query.trim()}
            onPress={() => void runSearch()}
          />
        </View>
        {!anchor ? (
          <AppText variant="caption" tone="muted">
            Use your location or enter an address first.
          </AppText>
        ) : null}
      </Panel>

      {results && results.length === 0 ? (
        <Panel>
          <AppText variant="body" weight="600">
            No gyms named “{query.trim()}” within 7 miles
          </AppText>
          <AppText variant="caption" tone="secondary">
            Try the chain’s full name, or search near a different address.
          </AppText>
        </Panel>
      ) : null}

      {results && results.length > 0 ? (
        <View
          style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {results.map((gym, i) => {
            const active = selected?.id === gym.id;
            return (
              <Pressable
                key={gym.id}
                accessibilityRole="button"
                accessibilityLabel={`${gym.name}, ${gym.address}, ${miles(gym.distanceM)} miles`}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSelected(gym);
                }}
                style={[
                  styles.result,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                  active && { backgroundColor: `${colors.accent}14` },
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    { borderColor: active ? colors.accent : colors.borderStrong },
                    active && { backgroundColor: colors.accent },
                  ]}
                >
                  {active ? <Ionicons name="checkmark" size={12} color={colors.onAccent} /> : null}
                </View>
                <View style={styles.grow}>
                  <AppText variant="body" weight="600" numberOfLines={1}>
                    {gym.name}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {gym.address}
                  </AppText>
                </View>
                <View style={styles.resultMeta}>
                  <AppText variant="caption" weight="600">
                    {miles(gym.distanceM)} mi
                  </AppText>
                  {gym.memberCount > 0 ? (
                    <AppText variant="micro" style={{ color: colors.accent }}>
                      {gym.memberCount} {gym.memberCount === 1 ? 'member' : 'members'}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {selected ? (
        <Panel accent>
          <AppText variant="body" weight="700" numberOfLines={1}>
            {selected.name}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={2}>
            {selected.address}
          </AppText>
          <SwitchRow
            label={`Join the ${selected.name} group`}
            caption="Everyone on Macronaut whose home gym this is. Leave any time."
            value={joinGroup}
            disabled={pending}
            onChange={(next) => {
              void Haptics.selectionAsync();
              setJoinGroup(next);
            }}
          />
          <Button
            title={confirmLabel}
            loading={claim.isPending}
            disabled={pending}
            onPress={() => void save()}
          />
        </Panel>
      ) : null}

      {error ? (
        <View style={[styles.error, { backgroundColor: `${colors.danger}12` }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <AppText
            variant="caption"
            tone="danger"
            style={styles.grow}
            accessibilityLiveRegion="polite"
          >
            {error}
          </AppText>
        </View>
      ) : null}

      {onSkip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
          onPress={onSkip}
          disabled={pending}
          style={styles.skip}
        >
          <AppText variant="caption" tone="secondary" weight="600">
            Skip for now
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function miles(distanceM: number): string {
  const value = metersToMiles(distanceM);
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

function Panel({ accent = false, children }: { accent?: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors.surface, borderColor: accent ? colors.accent : colors.border },
      ]}
    >
      {children}
    </View>
  );
}

function SwitchRow({
  label,
  caption,
  value,
  disabled,
  onChange,
}: {
  label: string;
  caption?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={styles.switchRow}
    >
      <View style={styles.grow}>
        <AppText variant="body" weight="600">
          {label}
        </AppText>
        {caption ? (
          <AppText variant="caption" tone="muted">
            {caption}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? colors.accent : colors.track }]}>
        <View
          style={[
            styles.knob,
            { backgroundColor: colors.surface, alignSelf: value ? 'flex-end' : 'flex-start' },
          ]}
        />
      </View>
    </Pressable>
  );
}

const TRACK_W = 46;
const TRACK_H = 28;
const KNOB = 24;

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  panel: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  grow: {
    flex: 1,
  },
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  locate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  anchorLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  results: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touchTarget + spacing.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget,
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: (TRACK_H - KNOB) / 2,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  skip: {
    alignSelf: 'center',
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
