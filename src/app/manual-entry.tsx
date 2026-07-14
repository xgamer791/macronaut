import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Nutrition } from '@/domain/types';
import { useRepos } from '@/state/AppProvider';
import { useAddDiaryEntry, useMealCategories } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { formatDayKey } from '@/utils/date';
import { goBackOrHome } from '@/utils/navigation';
import {
  AppText,
  Button,
  Card,
  NumberField,
  Screen,
  Sheet,
  TextField,
} from '@/ui/components';
import { spacing } from '@/ui/theme/tokens';

export default function ManualEntryScreen() {
  const router = useRouter();
  const { food } = useRepos();
  const categories = useMealCategories();
  const addEntry = useAddDiaryEntry();
  const date = useUiStore((s) => s.selectedDate);
  const initialMeal = useUiStore((s) => s.targetMeal);

  const [name, setName] = useState('');
  const [meal, setMeal] = useState(initialMeal);
  const [mealPickerOpen, setMealPickerOpen] = useState(false);
  const [time, setTime] = useState('');
  const [calories, setCalories] = useState<number | undefined>();
  const [protein, setProtein] = useState<number | undefined>();
  const [carbs, setCarbs] = useState<number | undefined>();
  const [fat, setFat] = useState<number | undefined>();
  const [fiber, setFiber] = useState<number | undefined>();
  const [sugar, setSugar] = useState<number | undefined>();
  const [sodium, setSodium] = useState<number | undefined>();
  const [cholesterol, setCholesterol] = useState<number | undefined>();
  const [servingDesc, setServingDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [saveAsFood, setSaveAsFood] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  const mealName =
    categories.data?.find((c) => c.id === meal)?.name ?? categories.data?.[0]?.name ?? 'Breakfast';

  function buildNutrition(): Nutrition {
    const n: Nutrition = { calories: calories ?? 0 };
    if (protein !== undefined) n.protein = protein;
    if (carbs !== undefined) n.carbs = carbs;
    if (fat !== undefined) n.fat = fat;
    if (fiber !== undefined) n.fiber = fiber;
    if (sugar !== undefined) n.sugar = sugar;
    if (sodium !== undefined) n.sodium = sodium;
    if (cholesterol !== undefined) n.cholesterol = cholesterol;
    return n;
  }

  async function save() {
    if (!name.trim()) {
      setNameError('Give this entry a name');
      return;
    }
    if (calories === undefined) return;
    const nutrition = buildNutrition();

    let foodKey: string | undefined;
    if (saveAsFood) {
      const created = await food.addCustomFood({
        name: name.trim(),
        servingQty: 1,
        servingUnit: 'serving',
        nutrition,
        notes: notes.trim() || undefined,
        favorite: false,
      });
      foodKey = `custom:${created.id}`;
    }

    await addEntry.mutateAsync({
      entry: {
        date,
        meal,
        time: time.trim() || undefined,
        name: name.trim(),
        sourceType: 'manual',
        sourceId: foodKey?.replace('custom:', ''),
        quantity: 1,
        unit: 'serving',
        servingDesc: servingDesc.trim() || undefined,
        nutrition,
        notes: notes.trim() || undefined,
      },
      foodKey,
    });
    goBackOrHome(router);
  }

  return (
    <Screen>
      <AppText variant="title" weight="600" display>
        Quick add
      </AppText>
      <AppText variant="caption" tone="secondary">
        Logging to {mealName} · {formatDayKey(date)}
      </AppText>

      <TextField
        label="Name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (t.trim()) setNameError(undefined);
        }}
        placeholder="Chicken bowl from the deli"
        error={nameError}
        required
      />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button title={`Meal: ${mealName}`} variant="secondary" onPress={() => setMealPickerOpen(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={undefined} value={time} onChangeText={setTime} placeholder="Time (optional, e.g. 12:30)" />
        </View>
      </View>

      <Card style={{ gap: spacing.md }}>
        <NumberField label="Calories" value={calories} onChange={setCalories} unit="kcal" required />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <NumberField label="Protein" value={protein} onChange={setProtein} unit="g" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Carbs" value={carbs} onChange={setCarbs} unit="g" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Fat" value={fat} onChange={setFat} unit="g" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <NumberField label="Fiber" value={fiber} onChange={setFiber} unit="g" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Sugar" value={sugar} onChange={setSugar} unit="g" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <NumberField label="Sodium" value={sodium} onChange={setSodium} unit="mg" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Cholesterol" value={cholesterol} onChange={setCholesterol} unit="mg" />
          </View>
        </View>
      </Card>

      <TextField
        label="Serving description (optional)"
        value={servingDesc}
        onChangeText={setServingDesc}
        placeholder="1 large bowl"
      />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything worth remembering"
        multiline
      />

      <Button
        title={saveAsFood ? '✓ Will save as a custom food' : 'Also save as a custom food'}
        variant={saveAsFood ? 'primary' : 'secondary'}
        onPress={() => setSaveAsFood(!saveAsFood)}
      />

      <Button
        title="Log entry"
        onPress={save}
        loading={addEntry.isPending}
        disabled={calories === undefined || !name.trim()}
      />
      <Button title="Cancel" variant="ghost" onPress={() => goBackOrHome(router)} />

      <Sheet visible={mealPickerOpen} onClose={() => setMealPickerOpen(false)} title="Meal">
        {(categories.data ?? []).map((cat) => (
          <Button
            key={cat.id}
            title={cat.name}
            variant={meal === cat.id ? 'primary' : 'secondary'}
            onPress={() => {
              setMeal(cat.id);
              setMealPickerOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
