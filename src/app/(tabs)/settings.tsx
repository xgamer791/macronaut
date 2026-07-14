import { useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { UnitSystem, WeekStart } from '@/domain/types';
import { useRepos } from '@/state/AppProvider';
import { keys, useMealCategories, useSetting } from '@/state/queries';
import { AppearanceMode, useTheme } from '@/ui/theme/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
  Sheet,
  TextField,
} from '@/ui/components';
import { spacing } from '@/ui/theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { settings, db } = useRepos();
  const { mode, setMode } = useTheme();
  const categories = useMealCategories();

  const units = useSetting<UnitSystem>('unitSystem', 'us');
  const weekStart = useSetting<WeekStart>('weekStart', 'monday');

  const [newMealOpen, setNewMealOpen] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [confirmReset, setConfirmReset] = useState<null | 'onboarding' | 'all'>(null);

  async function setUnits(u: UnitSystem) {
    await settings.setUnitSystem(u);
    qc.invalidateQueries({ queryKey: keys.setting('unitSystem') });
  }

  async function setWeekStart(w: WeekStart) {
    await settings.setWeekStart(w);
    qc.invalidateQueries({ queryKey: keys.setting('weekStart') });
    qc.invalidateQueries({ queryKey: ['diary-range'] });
  }

  async function resetOnboarding() {
    await settings.setOnboardingComplete(false);
    qc.clear();
    router.replace('/onboarding');
  }

  async function resetAllData() {
    // Drop every user table's rows; schema and migrations stay intact.
    await db.execAsync(`
      DELETE FROM diary_entries;
      DELETE FROM custom_foods;
      DELETE FROM cached_foods;
      DELETE FROM saved_meal_items;
      DELETE FROM saved_meals;
      DELETE FROM recipe_ingredients;
      DELETE FROM recipes;
      DELETE FROM food_log_history;
      DELETE FROM search_history;
      DELETE FROM favorites;
      DELETE FROM goal_configs;
      DELETE FROM day_type_marks;
      DELETE FROM settings;
      DELETE FROM meal_categories WHERE builtin = 0;
    `);
    qc.clear();
    router.replace('/onboarding');
  }

  return (
    <Screen tabBarSpace>
      <AppText variant="title" weight="600" display>
        Settings
      </AppText>

      <SectionHeader title="Goals" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        <ListRow
          title="Daily and weekly goals"
          subtitle="Targets, per-weekday, training and rest days, weekly total"
          onPress={() => router.push('/goals')}
        />
        <ListRow
          title="Weekly goal detail"
          subtitle="This week's target, breakdown and adherence"
          onPress={() => router.push({ pathname: '/week-detail', params: {} })}
        />
      </Card>

      <SectionHeader title="Preferences" />
      <Card style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            Units
          </AppText>
          <SegmentedControl<UnitSystem>
            options={[
              { value: 'us', label: 'US (lb, ft)' },
              { value: 'metric', label: 'Metric (kg, cm)' },
            ]}
            value={units.data ?? 'us'}
            onChange={setUnits}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            Week starts on
          </AppText>
          <SegmentedControl<WeekStart>
            options={[
              { value: 'monday', label: 'Monday' },
              { value: 'sunday', label: 'Sunday' },
            ]}
            value={weekStart.data ?? 'monday'}
            onChange={setWeekStart}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            Appearance
          </AppText>
          <SegmentedControl<AppearanceMode>
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </View>
      </Card>

      <SectionHeader title="Meal categories" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        {(categories.data ?? []).map((c) => (
          <ListRow key={c.id} title={c.name} subtitle={c.builtin ? 'Standard' : 'Custom'} />
        ))}
        <View style={{ paddingVertical: spacing.sm }}>
          <Button title="Add meal category" compact variant="secondary" onPress={() => setNewMealOpen(true)} />
        </View>
      </Card>

      <SectionHeader title="Data" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        <ListRow
          title="Reset onboarding"
          subtitle="Redo the setup wizard. Your food data stays."
          onPress={() => setConfirmReset('onboarding')}
        />
        <ListRow
          title="Delete all data"
          subtitle="Erases everything on this device. Cannot be undone."
          destructive
          onPress={() => setConfirmReset('all')}
        />
      </Card>

      <SectionHeader title="Privacy" />
      <Card>
        <AppText variant="caption" tone="secondary">
          All of your data lives in a local database on this device. Macronaut has no account
          system, no analytics and no tracking. Food search sends only your search text or a
          scanned barcode to the data providers below — never your diary.
        </AppText>
      </Card>

      <SectionHeader title="Food data sources" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        <ListRow
          title="USDA FoodData Central"
          subtitle="U.S. Department of Agriculture — public domain data"
          onPress={() => Linking.openURL('https://fdc.nal.usda.gov/')}
        />
        <ListRow
          title="Open Food Facts"
          subtitle="Open database of packaged foods — ODbL license"
          onPress={() => Linking.openURL('https://world.openfoodfacts.org/')}
        />
      </Card>

      <AppText variant="micro" tone="muted" align="center">
        Macronaut {Application.nativeApplicationVersion ?? '1.0.0'}
        {Platform.OS === 'web' ? ' · web preview' : ''}
      </AppText>

      {/* New meal category */}
      <Sheet visible={newMealOpen} onClose={() => setNewMealOpen(false)} title="New meal category">
        <TextField
          label="Name"
          value={newMealName}
          onChangeText={setNewMealName}
          placeholder="Pre-workout"
          autoFocus
        />
        <Button
          title="Add"
          disabled={!newMealName.trim()}
          onPress={async () => {
            await settings.addMealCategory(newMealName);
            qc.invalidateQueries({ queryKey: keys.mealCategories });
            setNewMealName('');
            setNewMealOpen(false);
          }}
        />
      </Sheet>

      {/* Confirmations */}
      <Sheet
        visible={confirmReset !== null}
        onClose={() => setConfirmReset(null)}
        title={confirmReset === 'all' ? 'Delete all data?' : 'Reset onboarding?'}
      >
        <AppText variant="body" tone="secondary">
          {confirmReset === 'all'
            ? 'This permanently erases your diary, foods, meals, recipes, goals and settings from this device. There is no way to recover them.'
            : 'You will go through the setup wizard again. Your diary, foods and history are kept.'}
        </AppText>
        <Button
          title={confirmReset === 'all' ? 'Yes, delete everything' : 'Yes, reset onboarding'}
          variant={confirmReset === 'all' ? 'danger' : 'primary'}
          onPress={() => {
            const kind = confirmReset;
            setConfirmReset(null);
            if (kind === 'all') resetAllData();
            else resetOnboarding();
          }}
        />
        <Button title="Cancel" variant="ghost" onPress={() => setConfirmReset(null)} />
      </Sheet>
    </Screen>
  );
}
