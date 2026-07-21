import type { ImageSource } from 'expo-image';
import type { Nutrition } from '@/domain/types';

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface CuratedIngredient {
  name: string;
  amount: string;
}

export interface CuratedMeal {
  id: string;
  name: string;
  /** Short “with …” subtitle matching Plan-style cards. */
  withLine: string;
  slot: MealSlot;
  description: string;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  nutrition: Nutrition;
  ingredients: CuratedIngredient[];
  directions: string[];
  tags: string[];
  image: ImageSource;
  curatedBy: 'Macronaut';
}

/** Bundled Macronaut-curated healthy meals — no user uploads. */
export const CURATED_MEALS: CuratedMeal[] = [
  {
    id: 'lemon-herb-chicken',
    name: 'Lemon Herb Chicken Bowl',
    withLine: 'with quinoa and roasted broccoli',
    slot: 'Lunch',
    description:
      'Juicy lemon-herb chicken over fluffy quinoa with crispy roasted broccoli and a bright citrus finish.',
    prepMinutes: 15,
    cookMinutes: 25,
    servings: 1,
    nutrition: { calories: 485, protein: 42, carbs: 44, fat: 14, fiber: 8 },
    ingredients: [
      { name: 'Chicken breast', amount: '150 g' },
      { name: 'Cooked quinoa', amount: '1 cup' },
      { name: 'Broccoli florets', amount: '1½ cups' },
      { name: 'Lemon juice', amount: '1 tbsp' },
      { name: 'Olive oil', amount: '1 tsp' },
      { name: 'Garlic, minced', amount: '1 clove' },
      { name: 'Fresh parsley', amount: '1 tbsp' },
      { name: 'Salt & black pepper', amount: 'to taste' },
    ],
    directions: [
      'Preheat oven to 425°F (220°C). Toss broccoli with half the oil, salt, and pepper; roast 18–20 minutes.',
      'Rub chicken with remaining oil, garlic, lemon juice, parsley, salt, and pepper.',
      'Pan-sear chicken over medium-high heat 5–6 minutes per side until cooked through (165°F).',
      'Rest chicken 3 minutes, slice, and serve over quinoa with roasted broccoli. Squeeze extra lemon if desired.',
    ],
    tags: ['high-protein', 'gluten-free'],
    image: require('../../assets/images/meals/meal-lemon-herb-chicken.jpg'),
    curatedBy: 'Macronaut',
  },
  {
    id: 'salmon-avocado-plate',
    name: 'Salmon Avocado Power Plate',
    withLine: 'with brown rice and cucumber salad',
    slot: 'Dinner',
    description:
      'Crisp-skinned salmon with creamy avocado, warm brown rice, and a cool cucumber salad.',
    prepMinutes: 10,
    cookMinutes: 15,
    servings: 1,
    nutrition: { calories: 560, protein: 38, carbs: 42, fat: 26, fiber: 7 },
    ingredients: [
      { name: 'Salmon fillet', amount: '150 g' },
      { name: 'Cooked brown rice', amount: '¾ cup' },
      { name: 'Avocado', amount: '½ medium' },
      { name: 'Cucumber, diced', amount: '1 cup' },
      { name: 'Rice vinegar', amount: '1 tsp' },
      { name: 'Olive oil', amount: '1 tsp' },
      { name: 'Lemon wedge', amount: '1' },
      { name: 'Salt & black pepper', amount: 'to taste' },
    ],
    directions: [
      'Pat salmon dry and season with salt and pepper.',
      'Heat oil in a nonstick skillet over medium-high. Sear salmon skin-side down 4–5 minutes, flip, and cook 3–4 minutes more.',
      'Toss cucumber with rice vinegar and a pinch of salt.',
      'Plate brown rice, salmon, avocado slices, and cucumber salad. Finish with lemon.',
    ],
    tags: ['omega-3', 'high-protein'],
    image: require('../../assets/images/meals/meal-salmon-avocado.jpg'),
    curatedBy: 'Macronaut',
  },
  {
    id: 'greek-turkey-pita',
    name: 'Greek Turkey Pita',
    withLine: 'with yogurt sauce and tomato cucumber',
    slot: 'Lunch',
    description:
      'Lean seasoned turkey tucked into a warm pita with cool yogurt sauce and crisp vegetables.',
    prepMinutes: 12,
    cookMinutes: 12,
    servings: 1,
    nutrition: { calories: 430, protein: 36, carbs: 40, fat: 13, fiber: 5 },
    ingredients: [
      { name: 'Ground turkey (93% lean)', amount: '120 g' },
      { name: 'Whole-wheat pita', amount: '1' },
      { name: 'Plain Greek yogurt', amount: '⅓ cup' },
      { name: 'Cucumber, diced', amount: '½ cup' },
      { name: 'Tomato, diced', amount: '½ cup' },
      { name: 'Red onion, sliced', amount: '2 tbsp' },
      { name: 'Oregano', amount: '½ tsp' },
      { name: 'Lemon juice', amount: '1 tsp' },
      { name: 'Salt & black pepper', amount: 'to taste' },
    ],
    directions: [
      'Cook turkey in a skillet over medium heat with oregano, salt, and pepper until browned, 6–8 minutes.',
      'Stir yogurt with lemon juice and a pinch of salt for the sauce.',
      'Warm the pita, then fill with turkey, cucumber, tomato, and onion.',
      'Drizzle with yogurt sauce and serve immediately.',
    ],
    tags: ['mediterranean', 'high-protein'],
    image: require('../../assets/images/meals/meal-greek-turkey-pita.jpg'),
    curatedBy: 'Macronaut',
  },
  {
    id: 'tofu-veggie-stir-fry',
    name: 'Tofu Veggie Stir-Fry',
    withLine: 'with brown rice and sesame greens',
    slot: 'Dinner',
    description:
      'Crispy tofu and colorful vegetables in a light savory sauce over nutty brown rice.',
    prepMinutes: 15,
    cookMinutes: 15,
    servings: 1,
    nutrition: { calories: 450, protein: 28, carbs: 48, fat: 16, fiber: 9 },
    ingredients: [
      { name: 'Firm tofu, cubed', amount: '150 g' },
      { name: 'Cooked brown rice', amount: '¾ cup' },
      { name: 'Broccoli florets', amount: '1 cup' },
      { name: 'Bell pepper, sliced', amount: '½ cup' },
      { name: 'Snap peas', amount: '½ cup' },
      { name: 'Low-sodium soy sauce', amount: '1 tbsp' },
      { name: 'Sesame oil', amount: '1 tsp' },
      { name: 'Garlic, minced', amount: '1 clove' },
      { name: 'Sesame seeds', amount: '1 tsp' },
    ],
    directions: [
      'Press tofu briefly, cube, and pan-fry in sesame oil until golden on most sides, 6–8 minutes. Set aside.',
      'Stir-fry broccoli, pepper, and snap peas with garlic 4–5 minutes until crisp-tender.',
      'Return tofu, add soy sauce, and toss 1 minute.',
      'Serve over brown rice and finish with sesame seeds.',
    ],
    tags: ['vegetarian', 'plant-forward'],
    image: require('../../assets/images/meals/meal-tofu-stir-fry.jpg'),
    curatedBy: 'Macronaut',
  },
  {
    id: 'steak-sweet-potato',
    name: 'Steak & Sweet Potato',
    withLine: 'with chimichurri and asparagus',
    slot: 'Dinner',
    description:
      'Seared steak with roasted sweet potato, bright chimichurri, and tender asparagus.',
    prepMinutes: 10,
    cookMinutes: 25,
    servings: 1,
    nutrition: { calories: 520, protein: 40, carbs: 36, fat: 22, fiber: 7 },
    ingredients: [
      { name: 'Sirloin steak', amount: '140 g' },
      { name: 'Sweet potato, cubed', amount: '1 medium' },
      { name: 'Asparagus spears', amount: '8' },
      { name: 'Parsley, chopped', amount: '2 tbsp' },
      { name: 'Garlic, minced', amount: '1 clove' },
      { name: 'Olive oil', amount: '2 tsp' },
      { name: 'Red wine vinegar', amount: '1 tsp' },
      { name: 'Salt & black pepper', amount: 'to taste' },
    ],
    directions: [
      'Roast sweet potato cubes tossed with 1 tsp oil at 425°F for 20–22 minutes.',
      'Mix parsley, garlic, remaining oil, vinegar, salt, and pepper for chimichurri.',
      'Season steak and sear 3–4 minutes per side for medium; rest 5 minutes, then slice.',
      'Sauté asparagus 3–4 minutes. Plate steak, sweet potato, and asparagus; spoon chimichurri over steak.',
    ],
    tags: ['high-protein', 'gluten-free'],
    image: require('../../assets/images/meals/meal-steak-sweet-potato.jpg'),
    curatedBy: 'Macronaut',
  },
  {
    id: 'shrimp-zucchini-noodles',
    name: 'Shrimp Zucchini Noodles',
    withLine: 'with garlic tomato sauce',
    slot: 'Dinner',
    description:
      'Garlicky shrimp over spiralized zucchini with a light tomato-basil sauce.',
    prepMinutes: 12,
    cookMinutes: 10,
    servings: 1,
    nutrition: { calories: 320, protein: 34, carbs: 16, fat: 12, fiber: 5 },
    ingredients: [
      { name: 'Shrimp, peeled', amount: '150 g' },
      { name: 'Zucchini, spiralized', amount: '2 medium' },
      { name: 'Cherry tomatoes, halved', amount: '1 cup' },
      { name: 'Garlic, minced', amount: '2 cloves' },
      { name: 'Olive oil', amount: '1 tsp' },
      { name: 'Fresh basil', amount: '2 tbsp' },
      { name: 'Red pepper flakes', amount: 'pinch' },
      { name: 'Salt & black pepper', amount: 'to taste' },
    ],
    directions: [
      'Heat oil in a large skillet. Sauté garlic 30 seconds, then add shrimp; cook 2–3 minutes per side until pink.',
      'Add cherry tomatoes and cook 2 minutes until they begin to soften.',
      'Add zucchini noodles and toss 1–2 minutes until just tender (do not overcook).',
      'Season, fold in basil and chili flakes, and serve immediately.',
    ],
    tags: ['low-carb', 'high-protein'],
    image: require('../../assets/images/meals/meal-shrimp-zoodles.jpg'),
    curatedBy: 'Macronaut',
  },
  {
    id: 'chickpea-buddha-bowl',
    name: 'Chickpea Buddha Bowl',
    withLine: 'with tahini drizzle and kale',
    slot: 'Lunch',
    description:
      'Roasted chickpeas, quinoa, and rainbow vegetables finished with a creamy tahini drizzle.',
    prepMinutes: 15,
    cookMinutes: 25,
    servings: 1,
    nutrition: { calories: 490, protein: 20, carbs: 58, fat: 20, fiber: 14 },
    ingredients: [
      { name: 'Chickpeas, rinsed', amount: '¾ cup' },
      { name: 'Cooked quinoa', amount: '¾ cup' },
      { name: 'Kale, chopped', amount: '2 cups' },
      { name: 'Carrot, shredded', amount: '½ cup' },
      { name: 'Red cabbage, shredded', amount: '½ cup' },
      { name: 'Avocado', amount: '¼' },
      { name: 'Tahini', amount: '1 tbsp' },
      { name: 'Lemon juice', amount: '1 tbsp' },
      { name: 'Olive oil', amount: '1 tsp' },
    ],
    directions: [
      'Toss chickpeas with oil, salt, and pepper; roast at 400°F for 20–25 minutes until crisp.',
      'Massage kale with a squeeze of lemon and a pinch of salt until softened.',
      'Whisk tahini with lemon juice and 1–2 tbsp water until pourable.',
      'Assemble quinoa, kale, carrot, cabbage, avocado, and chickpeas. Drizzle with tahini.',
    ],
    tags: ['vegan', 'high-fiber'],
    image: require('../../assets/images/meals/meal-chickpea-buddha.jpg'),
    curatedBy: 'Macronaut',
  },
  {
    id: 'egg-white-veggie-scramble',
    name: 'Egg White Veggie Scramble',
    withLine: 'with avocado toast and berries',
    slot: 'Breakfast',
    description:
      'Fluffy egg whites with sautéed vegetables, creamy avocado toast, and fresh berries.',
    prepMinutes: 8,
    cookMinutes: 10,
    servings: 1,
    nutrition: { calories: 360, protein: 28, carbs: 30, fat: 14, fiber: 8 },
    ingredients: [
      { name: 'Egg whites', amount: '1 cup (about 6)' },
      { name: 'Spinach', amount: '1 cup' },
      { name: 'Bell pepper, diced', amount: '⅓ cup' },
      { name: 'Mushrooms, sliced', amount: '⅓ cup' },
      { name: 'Whole-grain bread', amount: '1 slice' },
      { name: 'Avocado', amount: '¼' },
      { name: 'Mixed berries', amount: '½ cup' },
      { name: 'Salt & black pepper', amount: 'to taste' },
    ],
    directions: [
      'Sauté pepper and mushrooms 3–4 minutes; add spinach until wilted.',
      'Pour in egg whites and gently scramble over medium-low until just set.',
      'Toast bread and mash avocado on top with salt and pepper.',
      'Serve scramble with avocado toast and a side of berries.',
    ],
    tags: ['high-protein', 'vegetarian'],
    image: require('../../assets/images/meals/meal-egg-white-scramble.jpg'),
    curatedBy: 'Macronaut',
  },
];

export function getCuratedMeal(id: string): CuratedMeal | undefined {
  return CURATED_MEALS.find((m) => m.id === id);
}

export function searchCuratedMeals(query: string): CuratedMeal[] {
  const q = query.trim().toLowerCase();
  if (!q) return CURATED_MEALS;
  return CURATED_MEALS.filter((m) => {
    const hay = [
      m.name,
      m.withLine,
      m.description,
      m.slot,
      ...m.tags,
      ...m.ingredients.map((i) => i.name),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
