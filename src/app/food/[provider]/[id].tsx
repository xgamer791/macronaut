import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { roundForDisplay } from '@/domain/nutrition';
import { LOW_CONFIDENCE } from '@/services/food/confidence';
import { webFoodLookup } from '@/services/food/webFallback';
import {
  availableUnits,
  describePortion,
  FoodPortionInfo,
  portionNutrition,
  ServingUnit,
} from '@/domain/serving';
import { Nutrition } from '@/domain/types';
import { useRepos } from '@/state/AppProvider';
import { keys, useAddDiaryEntry, useMealCategories } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { formatDayKey } from '@/utils/date';
import { goBackOrHome } from '@/utils/navigation';
import {
  AppText,
  Button,
  Card,
  Chip,
  ErrorState,
  FoodImage,
  NumberField,
  Screen,
  ScreenHeader,
  Sheet,
  TargetEditor,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';

interface LoadedFood {
  key: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  info: FoodPortionInfo;
  source: string;
  sourceLabel: string;
  /** Exact source record description (attribution). */
  sourceDetail?: string;
  /** What the base nutrition describes ('per serving' / 'per 100 g' …). */
  basisLabel?: string;
  /** 0..1 accuracy confidence. */
  confidence?: number;
  /** Human-readable validation warnings. */
  warnings?: string[];
  flagged?: boolean;
  favorite: boolean;
  barcode?: string;
}

export default function FoodDetailScreen() {
  const { provider, id } = useLocalSearchParams<{ provider: string; id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { food } = useRepos();
  const categories = useMealCategories();
  const addEntry = useAddDiaryEntry();
  const date = useUiStore((s) => s.selectedDate);
  const meal = useUiStore((s) => s.targetMeal);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);

  const [quantity, setQuantity] = useState<number | undefined>(1);
  const [unit, setUnit] = useState<ServingUnit>('serving');
  const [mealPickerOpen, setMealPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [edited, setEdited] = useState<Nutrition | null>(null);

  const loaded = useQuery({
    queryKey: ['food-detail', provider, id],
    queryFn: async (): Promise<LoadedFood | null> => {
      if (provider === 'custom') {
        const f = await food.getCustomFood(id);
        if (!f) return null;
        return {
          key: `custom:${f.id}`,
          name: f.name,
          brand: f.brand,
          imageUrl: f.imageUrl,
          source: 'custom',
          sourceLabel: 'Your food',
          favorite: f.favorite,
          barcode: f.barcode,
          info: {
            nutritionPerServing: f.nutrition,
            gramsPerServing: f.gramsPerServing,
            servingLabel: `${f.servingQty} ${f.servingUnit}`,
          },
        };
      }
      if (provider === 'local') {
        const mod = await import('@/services/food/genericFoods');
        const gf = mod.getGenericFood(id);
        const rec = mod.getGenericFoodRecord(id);
        if (!gf || !rec) return null;
        return {
          key: `local:${gf.id}`,
          name: gf.name,
          source: 'local',
          sourceLabel: `USDA SR Legacy · FDC ${rec.fdcId}`,
          sourceDetail: rec.srDescription,
          favorite: await food.isFavorite(`local:${gf.id}`),
          info: {
            nutritionPerServing: gf.nutritionPerServing!,
            gramsPerServing: gf.gramsPerServing,
            servingLabel: gf.servingLabel,
          },
        };
      }
      if (provider === 'restaurant') {
        const mod = await import('@/services/food/restaurantFoods');
        const rf = mod.getRestaurantFood(id);
        if (!rf || !rf.nutritionPerServing) return null;
        return {
          key: `restaurant:${rf.id}`,
          name: rf.name,
          brand: rf.restaurant,
          source: 'restaurant',
          sourceLabel: rf.restaurant
            ? `Official ${rf.restaurant} nutrition`
            : 'Official restaurant nutrition',
          confidence: rf.confidence ?? 0.92,
          favorite: await food.isFavorite(`restaurant:${rf.id}`),
          info: {
            nutritionPerServing: rf.nutritionPerServing,
            gramsPerServing: rf.gramsPerServing,
            servingLabel: rf.servingLabel,
          },
        };
      }
      const c = await food.getCachedFood(provider, id);
      if (!c) return null;
      const [{ normalizeFood, SERVING_BASIS_LABEL }, { scoreConfidence }, { WARNING_LABELS }] =
        await Promise.all([
          import('@/services/food/normalize'),
          import('@/services/food/confidence'),
          import('@/services/food/nutritionValidation'),
        ]);
      const nf = normalizeFood({
        provider: c.provider,
        id: c.providerId,
        name: c.name,
        brand: c.brand,
        barcode: c.barcode,
        imageUrl: c.imageUrl,
        isGeneric: false,
        nutritionPer100g: c.nutritionPer100g,
        nutritionPerServing: c.nutritionPerServing,
        gramsPerServing: c.gramsPerServing,
        servingLabel: c.servingUnit,
      });
      if (!nf.perServing) return null;
      const confidence = c.confidence ?? scoreConfidence(nf, { scannedBarcode: c.barcode }).score;
      return {
        key: nf.key,
        name: c.name,
        brand: c.brand,
        imageUrl: c.imageUrl,
        source: c.provider,
        sourceLabel: nf.sourceLabel,
        basisLabel: SERVING_BASIS_LABEL[nf.servingBasis],
        confidence,
        warnings: nf.validation.warnings.map((w) => WARNING_LABELS[w]),
        flagged: c.flagged,
        favorite: await food.isFavorite(nf.key),
        barcode: c.barcode,
        info: {
          nutritionPerServing: nf.perServing,
          gramsPerServing: nf.gramsPerServing,
          servingLabel: nf.servingLabel ?? undefined,
        },
      };
    },
  });

  const f = loaded.data;
  const effectiveInfo: FoodPortionInfo | null = useMemo(() => {
    if (!f) return null;
    return edited ? { ...f.info, nutritionPerServing: edited } : f.info;
  }, [f, edited]);

  const nutrition = useMemo(() => {
    if (!effectiveInfo || quantity === undefined) return null;
    try {
      return portionNutrition(quantity, unit, effectiveInfo);
    } catch {
      return null;
    }
  }, [effectiveInfo, quantity, unit]);

  if (loaded.isLoading) {
    return (
      <Screen>
        <AppText variant="caption" tone="muted" align="center">
          Loading…
        </AppText>
      </Screen>
    );
  }

  if (!f || !effectiveInfo) {
    return (
      <Screen>
        <ErrorState
          title="Food unavailable"
          message="This food isn't in your device cache. Search for it again while online."
          retryTitle="Back"
          onRetry={() => goBackOrHome(router)}
        />
      </Screen>
    );
  }

  const units = availableUnits(effectiveInfo);
  const mealName = categories.data?.find((c) => c.id === meal)?.name ?? 'Breakfast';

  async function log() {
    if (!nutrition || quantity === undefined || !f) return;
    await addEntry.mutateAsync({
      entry: {
        date,
        meal,
        name: f.name,
        brand: f.brand,
        sourceType: f.source === 'custom' ? 'custom' : 'provider',
        sourceId: f.key,
        quantity,
        unit,
        servingDesc: describePortion(quantity, unit, effectiveInfo!),
        imageUrl: f.imageUrl,
        nutrition,
        notes: edited ? 'Edited nutrition (this entry only)' : undefined,
      },
      foodKey: f.key,
    });
    goBackOrHome(router);
  }

  async function saveEditedAsCustom() {
    if (!edited || !f) return;
    const created = await food.addCustomFood({
      name: f.name,
      brand: f.brand,
      barcode: f.barcode,
      imageUrl: f.imageUrl,
      servingQty: 1,
      servingUnit: 'serving',
      gramsPerServing: f.info.gramsPerServing,
      nutrition: edited,
      favorite: false,
      sourceProvider: f.source !== 'custom' ? f.source : undefined,
      sourceId: f.key,
    });
    qc.invalidateQueries({ queryKey: ['custom-foods'] });
    setEditOpen(false);
    router.replace({ pathname: '/food/[provider]/[id]', params: { provider: 'custom', id: created.id } });
  }

  return (
    <Screen>
      <ScreenHeader
        title="Food"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={f.favorite ? 'Remove favorite' : 'Add favorite'}
            onPress={async () => {
              if (f.source === 'custom') {
                await food.setCustomFavorite(id, !f.favorite);
              } else {
                await food.setFavorite(f.key, !f.favorite);
              }
              qc.invalidateQueries({ queryKey: ['food-detail', provider, id] });
              qc.invalidateQueries({ queryKey: keys.favorites });
            }}
            style={{ minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons
              name={f.favorite ? 'star' : 'star-outline'}
              size={22}
              color={f.favorite ? colors.warning : colors.textMuted}
            />
          </Pressable>
        }
      />

      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <FoodImage uri={f.imageUrl} size={64} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading" weight="600" display>
            {f.name}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {[f.brand, f.sourceLabel].filter(Boolean).join(' · ')}
          </AppText>
          {f.sourceDetail ? (
            <AppText variant="micro" tone="muted">
              {f.sourceDetail}
            </AppText>
          ) : null}
          {f.basisLabel ? (
            <AppText variant="micro" tone="muted">
              Nutrition {f.basisLabel}
            </AppText>
          ) : null}
          {edited ? (
            <AppText variant="micro" tone="accent">
              Edited nutrition (not from the database)
            </AppText>
          ) : null}
        </View>
      </View>

      {!edited && f.confidence !== undefined && f.confidence < LOW_CONFIDENCE ? (
        <Card style={{ gap: spacing.sm, borderColor: colors.warning }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <AppText variant="caption" weight="600">
              Double-check this before logging
            </AppText>
          </View>
          <AppText variant="micro" tone="secondary">
            {f.warnings && f.warnings.length > 0
              ? f.warnings.join(' · ')
              : 'This is low-confidence community data.'}{' '}
            Edit the values against the package label, or look it up on the web.
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Edit nutrition" compact variant="secondary" onPress={() => setEditOpen(true)} />
            <Button
              title="Search the web"
              compact
              variant="ghost"
              onPress={() =>
                Linking.openURL(webFoodLookup.searchUrl({ barcode: f.barcode, name: f.name, brand: f.brand }))
              }
            />
          </View>
        </Card>
      ) : null}

      <Card style={{ gap: spacing.md }}>
        <NumberField label="Quantity" value={quantity} onChange={setQuantity} min={0.01} />
        {units.includes('g') ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {[100, 150, 200, 250, 300].map((grams) => (
              <Chip
                key={grams}
                label={`${grams} g`}
                selected={unit === 'g' && quantity === grams}
                onPress={() => {
                  setUnit('g');
                  setQuantity(grams);
                }}
              />
            ))}
          </View>
        ) : null}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            Unit
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {units.map((u) => (
              <Chip
                key={u}
                label={u === 'serving' ? (effectiveInfo.servingLabel ?? 'serving') : u}
                selected={unit === u}
                onPress={() => setUnit(u)}
              />
            ))}
          </View>
        </View>
        <Button title={`Meal: ${mealName}`} variant="secondary" onPress={() => setMealPickerOpen(true)} />
        <AppText variant="caption" tone="muted">
          {formatDayKey(date)}
        </AppText>
      </Card>

      {nutrition ? (
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <AppText variant="hero" weight="600" display>
              {Math.round(nutrition.calories)}
            </AppText>
            <AppText variant="caption" tone="muted">
              kcal for {describePortion(quantity ?? 0, unit, effectiveInfo)}
            </AppText>
          </View>
          <FactRow label="Protein" value={nutrition.protein} unit="g" />
          <FactRow label="Carbohydrates" value={nutrition.carbs} unit="g" />
          <FactRow label="Fat" value={nutrition.fat} unit="g" />
          <FactRow label="Fiber" value={nutrition.fiber} unit="g" />
          <FactRow label="Sugar" value={nutrition.sugar} unit="g" />
          <FactRow label="Sodium" value={nutrition.sodium} unit="mg" />
          <FactRow label="Cholesterol" value={nutrition.cholesterol} unit="mg" />
          {nutrition.micros
            ? Object.entries(nutrition.micros).map(([name, m]) => (
                <FactRow key={name} label={name} value={m.amount} unit={m.unit} />
              ))
            : null}
        </Card>
      ) : (
        <Card>
          <AppText variant="caption" tone="secondary">
            Enter a quantity to see nutrition for this portion.
          </AppText>
        </Card>
      )}

      <Button title={`Add to ${mealName}`} onPress={log} loading={addEntry.isPending} disabled={!nutrition} />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button
          title="Edit nutrition"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => setEditOpen(true)}
        />
        {f.source !== 'custom' ? (
          <Button
            title={f.flagged ? 'Flagged ✓' : 'Report inaccurate'}
            variant="ghost"
            style={{ flex: 1 }}
            onPress={async () => {
              await food.setFlagged(f.source, id, !f.flagged);
              qc.invalidateQueries({ queryKey: ['food-detail', provider, id] });
            }}
          />
        ) : null}
      </View>

      <Sheet visible={mealPickerOpen} onClose={() => setMealPickerOpen(false)} title="Meal">
        {(categories.data ?? []).map((cat) => (
          <Button
            key={cat.id}
            title={cat.name}
            variant={meal === cat.id ? 'primary' : 'secondary'}
            onPress={() => {
              setTargetMeal(cat.id);
              setMealPickerOpen(false);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)} title="Edit nutrition (per serving)">
        <AppText variant="caption" tone="secondary">
          Database values stay untouched. Use your edits for this log only, or save them as your own
          custom food.
        </AppText>
        <TargetEditor
          value={(edited ?? effectiveInfo.nutritionPerServing) as Nutrition}
          onChange={(n) => setEdited(n)}
        />
        <Button title="Use for this entry only" onPress={() => setEditOpen(false)} />
        <Button title="Save as custom food" variant="secondary" onPress={saveEditedAsCustom} />
        <Button
          title="Discard edits"
          variant="ghost"
          onPress={() => {
            setEdited(null);
            setEditOpen(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}

function FactRow({ label, value, unit }: { label: string; value?: number; unit: string }) {
  if (value === undefined) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="caption">
        {roundForDisplay(value)} {unit}
      </AppText>
    </View>
  );
}

