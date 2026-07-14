import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { roundForDisplay, scaleNutrition, sumNutrition } from '@/domain/nutrition';
import { Nutrition } from '@/domain/types';
import { CollectionInput, CollectionItemInput } from '@/repositories/collectionsRepo';
import { useRepos } from '@/state/AppProvider';
import { useDebounced } from '@/state/foodSearch';
import { goBackOrHome } from '@/utils/navigation';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { ListRow } from './ListRow';
import { NumberField } from './NumberField';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';
import { Sheet } from './Sheet';
import { TextField } from './TextField';

export interface CollectionEditorProps {
  kind: 'meal' | 'recipe';
  /** Existing id to edit, or undefined to create. */
  id?: string;
}

/** Shared editor for saved meals and recipes: name/image/servings/notes +
 * an ingredient list with live total and per-serving nutrition. */
export function CollectionEditor({ kind, id }: CollectionEditorProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { savedMeals, recipes, food } = useRepos();
  const repo = kind === 'recipe' ? recipes : savedMeals;
  const isRecipe = kind === 'recipe';

  interface Loaded {
    name: string;
    imageUrl?: string;
    servings: number;
    notes?: string;
    items: CollectionItemInput[];
  }
  const existing = useQuery({
    queryKey: ['collection-edit', kind, id ?? 'new'],
    enabled: !!id,
    queryFn: async (): Promise<Loaded | null> => {
      if (isRecipe) {
        const r = await recipes.get(id!);
        return r ? { ...r, items: r.ingredients } : null;
      }
      const m = await savedMeals.get(id!);
      return m ? { ...m, items: m.items } : null;
    },
  });

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [servings, setServings] = useState<number | undefined>(isRecipe ? 4 : 1);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CollectionItemInput[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickQuery, setPickQuery] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [mName, setMName] = useState('');
  const [mQty, setMQty] = useState<number | undefined>(1);
  const [mUnit, setMUnit] = useState('serving');
  const [mCal, setMCal] = useState<number | undefined>();
  const [mProtein, setMProtein] = useState<number | undefined>();
  const [mCarbs, setMCarbs] = useState<number | undefined>();
  const [mFat, setMFat] = useState<number | undefined>();

  const debouncedPick = useDebounced(pickQuery, 250);
  const pickResults = useQuery({
    queryKey: ['ingredient-search', debouncedPick],
    enabled: pickerOpen && debouncedPick.length >= 2,
    queryFn: async () => {
      const [custom, cached] = await Promise.all([
        food.listCustomFoods(debouncedPick),
        food.searchCached(debouncedPick, 10),
      ]);
      return { custom, cached };
    },
  });

  if (existing.data && !hydrated) {
    const e = existing.data;
    setName(e.name);
    setImageUrl(e.imageUrl ?? '');
    setServings(e.servings);
    setNotes(e.notes ?? '');
    setItems(
      e.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unit: it.unit,
        nutrition: it.nutrition,
        sourceType: it.sourceType,
        sourceId: it.sourceId,
      })),
    );
    setHydrated(true);
  }

  const total = sumNutrition(items.map((i) => i.nutrition));
  const per = servings && servings > 0 ? scaleNutrition(total, 1 / servings) : total;

  function addItem(item: CollectionItemInput) {
    setItems((prev) => [...prev, item]);
    setPickerOpen(false);
    setPickQuery('');
  }

  async function save() {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    if (!servings || servings <= 0) return;
    setSaving(true);
    try {
      const input: CollectionInput = {
        name: name.trim(),
        imageUrl: imageUrl.trim() || undefined,
        servings,
        notes: notes.trim() || undefined,
        items,
      };
      if (id) await repo.update(id, input);
      else await repo.create(input);
      qc.invalidateQueries({ queryKey: [isRecipe ? 'recipes' : 'saved-meals'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
      qc.invalidateQueries({ queryKey: ['collection-edit'] });
      goBackOrHome(router);
    } finally {
      setSaving(false);
    }
  }

  const label = isRecipe ? 'recipe' : 'meal';

  return (
    <Screen>
      <ScreenHeader title={id ? `Edit ${label}` : `New ${label}`} />

      <TextField
        label="Name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (t.trim()) setNameError(undefined);
        }}
        placeholder={isRecipe ? 'Chicken burrito bowls' : 'My usual breakfast'}
        error={nameError}
        required
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label={isRecipe ? 'Recipe makes (servings)' : 'Servings'}
            value={servings}
            onChange={setServings}
            min={0.25}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Image URL (optional)"
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://…"
            autoCapitalize="none"
          />
        </View>
      </View>

      <Card style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="body" weight="600">
            {isRecipe ? 'Ingredients' : 'Foods'}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {items.length} item{items.length === 1 ? '' : 's'}
          </AppText>
        </View>
        {items.map((it, i) => (
          <ListRow
            key={`${it.name}-${i}`}
            title={it.name}
            subtitle={`${it.quantity} ${it.unit}`}
            value={`${Math.round(it.nutrition.calories)} kcal`}
            onPress={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
            accessibilityHint="Tap to remove"
          />
        ))}
        {items.length === 0 ? (
          <AppText variant="caption" tone="muted">
            Nothing added yet.
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Add ingredient" compact variant="secondary" onPress={() => setPickerOpen(true)} />
          <Button title="Add manual item" compact variant="ghost" onPress={() => setManualOpen(true)} />
        </View>
      </Card>

      <Card style={{ gap: 4 }}>
        <AppText variant="caption" tone="muted">
          Total: {Math.round(total.calories)} kcal · P {roundForDisplay(total.protein ?? 0)} · C{' '}
          {roundForDisplay(total.carbs ?? 0)} · F {roundForDisplay(total.fat ?? 0)}
        </AppText>
        <AppText variant="body" weight="600">
          Per serving: {Math.round(per.calories)} kcal · P {roundForDisplay(per.protein ?? 0)} · C{' '}
          {roundForDisplay(per.carbs ?? 0)} · F {roundForDisplay(per.fat ?? 0)}
        </AppText>
      </Card>

      <TextField
        label={isRecipe ? 'Preparation notes (optional)' : 'Notes (optional)'}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Button title={id ? 'Save changes' : `Create ${label}`} onPress={save} loading={saving} />
      {id ? (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button
            title="Duplicate"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={async () => {
              await repo.duplicate(id);
              qc.invalidateQueries({ queryKey: [isRecipe ? 'recipes' : 'saved-meals'] });
              goBackOrHome(router);
            }}
          />
          <Button
            title="Delete"
            variant="danger"
            style={{ flex: 1 }}
            onPress={async () => {
              await repo.remove(id);
              qc.invalidateQueries({ queryKey: [isRecipe ? 'recipes' : 'saved-meals'] });
              goBackOrHome(router);
            }}
          />
        </View>
      ) : null}
      <Button title="Cancel" variant="ghost" onPress={() => goBackOrHome(router)} />

      {/* Ingredient search picker (local foods: custom + previously seen) */}
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Add ingredient">
        <TextField
          value={pickQuery}
          onChangeText={setPickQuery}
          placeholder="Search your foods and cached foods"
          autoFocus
        />
        {(pickResults.data?.custom ?? []).map((f) => (
          <ListRow
            key={`c-${f.id}`}
            title={f.name}
            subtitle={`Your food · ${Math.round(f.nutrition.calories)} kcal/serving`}
            onPress={() =>
              addItem({
                name: f.name,
                quantity: 1,
                unit: 'serving',
                nutrition: f.nutrition,
                sourceType: 'custom',
                sourceId: f.id,
              })
            }
          />
        ))}
        {(pickResults.data?.cached ?? []).map((f) => {
          const per: Nutrition | undefined = f.nutritionPerServing ?? f.nutritionPer100g;
          if (!per) return null;
          return (
            <ListRow
              key={`k-${f.provider}-${f.providerId}`}
              title={f.name}
              subtitle={`${f.brand ?? f.provider.toUpperCase()} · ${Math.round(per.calories)} kcal`}
              onPress={() =>
                addItem({
                  name: f.name,
                  quantity: 1,
                  unit: f.nutritionPerServing ? 'serving' : '100 g',
                  nutrition: per,
                  sourceType: 'provider',
                  sourceId: `${f.provider}:${f.providerId}`,
                })
              }
            />
          );
        })}
        {pickQuery.length >= 2 &&
        (pickResults.data?.custom.length ?? 0) === 0 &&
        (pickResults.data?.cached.length ?? 0) === 0 ? (
          <AppText variant="caption" tone="muted">
            Nothing local matches. Foods appear here after you search or log them once, or add a
            manual item instead.
          </AppText>
        ) : null}
      </Sheet>

      {/* Manual item */}
      <Sheet visible={manualOpen} onClose={() => setManualOpen(false)} title="Manual item">
        <TextField label="Name" value={mName} onChangeText={setMName} placeholder="Olive oil" required />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <NumberField label="Quantity" value={mQty} onChange={setMQty} min={0.01} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Unit" value={mUnit} onChangeText={setMUnit} placeholder="tbsp" />
          </View>
        </View>
        <NumberField label="Calories (total for this amount)" value={mCal} onChange={setMCal} unit="kcal" required />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <NumberField label="Protein" value={mProtein} onChange={setMProtein} unit="g" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Carbs" value={mCarbs} onChange={setMCarbs} unit="g" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Fat" value={mFat} onChange={setMFat} unit="g" />
          </View>
        </View>
        <Button
          title="Add item"
          disabled={!mName.trim() || mCal === undefined}
          onPress={() => {
            const n: Nutrition = { calories: mCal ?? 0 };
            if (mProtein !== undefined) n.protein = mProtein;
            if (mCarbs !== undefined) n.carbs = mCarbs;
            if (mFat !== undefined) n.fat = mFat;
            addItem({
              name: mName.trim(),
              quantity: mQty ?? 1,
              unit: mUnit.trim() || 'serving',
              nutrition: n,
            });
            setManualOpen(false);
            setMName('');
            setMCal(undefined);
            setMProtein(undefined);
            setMCarbs(undefined);
            setMFat(undefined);
          }}
        />
      </Sheet>
    </Screen>
  );
}
