import type { ImageSource } from 'expo-image';
import type { Nutrition } from '@/domain/types';

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
export type MealDifficulty = 'easy' | 'medium' | 'hard';

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
  difficulty: MealDifficulty;
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
  /** Public recipe inspiration source (attribution). */
  sourceUrl?: string;
}

export const MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

/**
 * Active main meal for a local hour. Snacks are never auto-promoted.
 * Breakfast 5–10, Lunch 11–15, Dinner otherwise (incl. late night).
 */
export function mealSlotForHour(hour: number = new Date().getHours()): Exclude<MealSlot, 'Snack'> {
  if (hour >= 5 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 16) return 'Lunch';
  return 'Dinner';
}

/** Carousel order: current meal period first, other mains next, Snacks always last. */
export function orderedMealSlots(hour: number = new Date().getHours()): MealSlot[] {
  const current = mealSlotForHour(hour);
  const mains: Exclude<MealSlot, 'Snack'>[] = ['Breakfast', 'Lunch', 'Dinner'];
  return [current, ...mains.filter((s) => s !== current), 'Snack'];
}

export function slotSectionTitle(slot: MealSlot): string {
  return slot === 'Snack' ? 'Snacks' : slot;
}

/** Bundled Macronaut-curated healthy meals — no user uploads. */
export const CURATED_MEALS: CuratedMeal[] = [
  // ── Existing ────────────────────────────────────────────────────────────
  {
    id: 'lemon-herb-chicken',
    name: 'Lemon Herb Chicken Bowl',
    withLine: 'with quinoa and roasted broccoli',
    slot: 'Lunch',
    difficulty: 'medium',
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
      'Rest chicken 3 minutes, slice, and serve over quinoa with roasted broccoli.',
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
    difficulty: 'medium',
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
    difficulty: 'easy',
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
    difficulty: 'medium',
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
      'Press tofu briefly, cube, and pan-fry in sesame oil until golden, 6–8 minutes. Set aside.',
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
    difficulty: 'medium',
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
    difficulty: 'easy',
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
      'Add zucchini noodles and toss 1–2 minutes until just tender.',
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
    difficulty: 'medium',
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
    difficulty: 'easy',
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

  // ── New breakfasts (web-sourced) ────────────────────────────────────────
  {
    id: 'berry-baked-oatmeal',
    name: 'Berry Baked Oatmeal',
    withLine: 'with Greek yogurt and chia',
    slot: 'Breakfast',
    difficulty: 'easy',
    description:
      'High-protein baked oatmeal with Greek yogurt, eggs, chia, and berries — meal-prep friendly.',
    prepMinutes: 10,
    cookMinutes: 30,
    servings: 4,
    nutrition: { calories: 320, protein: 32, carbs: 36, fat: 8, fiber: 11 },
    ingredients: [
      { name: 'Plain Greek yogurt', amount: '1½ cups' },
      { name: 'Milk', amount: '½ cup' },
      { name: 'Eggs', amount: '4' },
      { name: 'Egg whites', amount: '1 cup' },
      { name: 'Maple syrup', amount: '1 tbsp' },
      { name: 'Vanilla extract', amount: '2 tsp' },
      { name: 'Rolled oats', amount: '2 cups' },
      { name: 'Chia seeds', amount: '¼ cup' },
      { name: 'Cinnamon', amount: '2 tsp' },
      { name: 'Baking powder', amount: '1 tsp' },
      { name: 'Berries', amount: '2 cups' },
    ],
    directions: [
      'Preheat oven to 425°F. Grease a 9×13-inch baking dish (or 4 oven-safe containers).',
      'Whisk yogurt, milk, eggs, egg whites, maple syrup, and vanilla. Stir in oats, chia, cinnamon, and baking powder.',
      'Pour into the dish, top with berries, and bake 25–30 minutes until a toothpick comes out clean.',
      'Cool slightly; serve warm or refrigerate portions for the week.',
    ],
    tags: ['high-protein', 'meal-prep', 'vegetarian'],
    image: require('../../assets/images/meals/meal-berry-baked-oatmeal.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://delightfullyfueled.com/berry-baked-oatmeal/',
  },
  {
    id: 'fluffy-protein-oatmeal',
    name: 'Fluffy Protein Oatmeal',
    withLine: 'with whisked eggs and cinnamon',
    slot: 'Breakfast',
    difficulty: 'easy',
    description:
      'Stovetop oatmeal whisked with eggs for a light, fluffy texture and ~23g protein — no powder needed.',
    prepMinutes: 5,
    cookMinutes: 10,
    servings: 1,
    nutrition: { calories: 340, protein: 23, carbs: 38, fat: 10, fiber: 6 },
    ingredients: [
      { name: 'Old-fashioned oats', amount: '½ cup' },
      { name: 'Milk', amount: '½ cup' },
      { name: 'Water', amount: '½ cup' },
      { name: 'Eggs', amount: '2' },
      { name: 'Chia seeds', amount: '2 tsp' },
      { name: 'Maple syrup', amount: '1 tbsp' },
      { name: 'Vanilla extract', amount: '½ tsp' },
      { name: 'Cinnamon', amount: '¼ tsp' },
      { name: 'Salt', amount: 'pinch' },
      { name: 'Fresh berries', amount: '½ cup' },
    ],
    directions: [
      'Whisk eggs in a small bowl; set aside.',
      'Combine oats, milk, and water in a saucepan; bring to a gentle boil, then reduce to medium.',
      'Stir in chia, maple, vanilla, cinnamon, and salt; cook 4–5 minutes until thickened.',
      'Stir in whisked eggs for ~30–60 seconds until fluffy and cooked. Top with berries.',
    ],
    tags: ['high-protein', 'vegetarian', 'quick'],
    image: require('../../assets/images/meals/meal-protein-oatmeal.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://www.daisybeet.com/quick-easy-stovetop-protein-oatmeal-with-eggs/',
  },
  {
    id: 'cottage-cheese-pancakes',
    name: 'Cottage Cheese Pancakes',
    withLine: 'with berries and yogurt',
    slot: 'Breakfast',
    difficulty: 'medium',
    description:
      'Blender pancakes with cottage cheese, oats, and whole-wheat flour for a high-protein stack.',
    prepMinutes: 10,
    cookMinutes: 15,
    servings: 2,
    nutrition: { calories: 390, protein: 28, carbs: 36, fat: 14, fiber: 5 },
    ingredients: [
      { name: 'Cottage cheese', amount: '1½ cups' },
      { name: 'Rolled oats', amount: '1 cup' },
      { name: 'Eggs', amount: '4' },
      { name: 'Whole-wheat flour', amount: '⅔ cup' },
      { name: 'Baking powder', amount: '1 tbsp' },
      { name: 'Butter, melted', amount: '2 tbsp' },
      { name: 'Vanilla extract', amount: '1 tsp' },
      { name: 'Mixed berries', amount: '1 cup' },
      { name: 'Greek yogurt', amount: '½ cup' },
    ],
    directions: [
      'Whisk flour and baking powder in a bowl.',
      'Blend cottage cheese, oats, eggs, melted butter, vanilla, and a pinch of salt until smooth (~1 minute).',
      'Whisk wet mixture into flour until just combined (batter will be thick).',
      'Cook ¼-cup rounds in a lightly oiled nonstick skillet ~2 minutes per side. Serve with yogurt and berries.',
    ],
    tags: ['high-protein', 'vegetarian'],
    image: require('../../assets/images/meals/meal-cottage-pancakes.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://www.americastestkitchen.com/recipes/16856-cottage-cheese-pancakes',
  },
  {
    id: 'cottage-overnight-oats',
    name: 'Cottage Cheese Overnight Oats',
    withLine: 'with chia and peanut butter',
    slot: 'Breakfast',
    difficulty: 'easy',
    description:
      'No-cook overnight oats with cottage cheese and chia for a creamy ~20g protein breakfast.',
    prepMinutes: 5,
    cookMinutes: 0,
    servings: 1,
    nutrition: { calories: 380, protein: 22, carbs: 42, fat: 12, fiber: 8 },
    ingredients: [
      { name: 'Rolled oats', amount: '½ cup' },
      { name: 'Low-fat cottage cheese', amount: '¼ cup' },
      { name: 'Unsweetened almond milk', amount: '½ cup' },
      { name: 'Chia seeds', amount: '2 tsp' },
      { name: 'Peanut butter', amount: '½ tbsp' },
      { name: 'Maple syrup', amount: '½ tbsp' },
      { name: 'Cinnamon', amount: '½ tsp' },
      { name: 'Berries', amount: '½ cup' },
    ],
    directions: [
      'Add oats, cottage cheese, milk, chia, peanut butter, maple, and cinnamon to a jar.',
      'Stir until well combined, cover, and refrigerate overnight (at least 4 hours).',
      'Stir before serving and top with berries.',
    ],
    tags: ['high-protein', 'meal-prep', 'no-cook'],
    image: require('../../assets/images/meals/meal-overnight-oats.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://cleananddelicious.com/protein-packed-overnight-oats-with-cottage-cheese/',
  },
  {
    id: 'greek-yogurt-parfait',
    name: 'Greek Yogurt Berry Parfait',
    withLine: 'with granola and honey',
    slot: 'Breakfast',
    difficulty: 'easy',
    description:
      'Layered Greek yogurt, crunchy granola, and fresh berries — a classic high-protein breakfast in minutes.',
    prepMinutes: 5,
    cookMinutes: 0,
    servings: 1,
    nutrition: { calories: 340, protein: 26, carbs: 40, fat: 8, fiber: 5 },
    ingredients: [
      { name: 'Plain nonfat Greek yogurt', amount: '1 cup' },
      { name: 'Granola', amount: '⅓ cup' },
      { name: 'Strawberries, sliced', amount: '½ cup' },
      { name: 'Blueberries', amount: '⅓ cup' },
      { name: 'Honey', amount: '1 tsp' },
    ],
    directions: [
      'Spoon half the yogurt into a glass or bowl.',
      'Add half the granola and berries.',
      'Repeat layers with remaining yogurt, granola, and berries.',
      'Drizzle with honey and serve immediately so granola stays crisp.',
    ],
    tags: ['high-protein', 'vegetarian', 'quick'],
    image: require('../../assets/images/meals/meal-yogurt-parfait.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://www.eatingwell.com/',
  },

  // ── New lunches ─────────────────────────────────────────────────────────
  {
    id: 'chickpea-farro-bowl',
    name: 'Chickpea Farro Bowl',
    withLine: 'with feta, tomato, and avocado',
    slot: 'Lunch',
    difficulty: 'easy',
    description:
      'EatingWell-style grain bowl: nutty farro, chickpeas, cucumber, tomato, avocado, and feta with lemon-oregano dressing.',
    prepMinutes: 15,
    cookMinutes: 0,
    servings: 1,
    nutrition: { calories: 538, protein: 20, carbs: 72, fat: 22, fiber: 15 },
    ingredients: [
      { name: 'Cooked farro', amount: '¾ cup' },
      { name: 'Chickpeas, rinsed', amount: '¼ cup' },
      { name: 'Grape tomatoes, halved', amount: '¼ cup' },
      { name: 'Cucumber, diced', amount: '¼ cup' },
      { name: 'Avocado, diced', amount: '¼' },
      { name: 'Feta, crumbled', amount: '¼ cup' },
      { name: 'Extra-virgin olive oil', amount: '1½ tsp' },
      { name: 'Lemon juice', amount: '¾ tsp' },
      { name: 'Red-wine vinegar', amount: '¾ tsp' },
      { name: 'Dried oregano', amount: '¼ tsp' },
    ],
    directions: [
      'Whisk oil, lemon juice, vinegar, oregano, salt, and pepper for the dressing.',
      'Place farro in a bowl; top with chickpeas, tomatoes, cucumber, avocado, and feta.',
      'Drizzle with dressing and toss lightly before serving.',
    ],
    tags: ['vegetarian', 'high-fiber', 'mediterranean'],
    image: require('../../assets/images/meals/meal-chickpea-farro-bowl.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://www.eatingwell.com/chickpea-grain-bowl-with-feta-tomatoes-11742803',
  },
  {
    id: 'turkey-chili',
    name: 'Lean Turkey Chili',
    withLine: 'with beans and Greek yogurt',
    slot: 'Lunch',
    difficulty: 'medium',
    description:
      'Hearty ground-turkey chili with beans and spices — high protein, freezer-friendly, topped with cool yogurt.',
    prepMinutes: 15,
    cookMinutes: 35,
    servings: 4,
    nutrition: { calories: 360, protein: 34, carbs: 32, fat: 10, fiber: 9 },
    ingredients: [
      { name: 'Extra-lean ground turkey', amount: '1 lb' },
      { name: 'Onion, diced', amount: '1' },
      { name: 'Garlic, minced', amount: '3 cloves' },
      { name: 'Bell pepper, diced', amount: '1' },
      { name: 'Canned diced tomatoes', amount: '1 (14 oz)' },
      { name: 'Tomato paste', amount: '2 tbsp' },
      { name: 'Black beans, rinsed', amount: '1 (15 oz)' },
      { name: 'Chili powder', amount: '1 tbsp' },
      { name: 'Cumin', amount: '1 tsp' },
      { name: 'Low-sodium broth', amount: '1 cup' },
      { name: 'Plain Greek yogurt', amount: '¼ cup (to serve)' },
    ],
    directions: [
      'Sauté onion, pepper, and garlic in a pot 4–5 minutes. Add turkey and cook until no longer pink.',
      'Stir in tomato paste, chili powder, cumin, salt, and pepper.',
      'Add diced tomatoes, beans, and broth. Simmer uncovered 25–30 minutes, stirring occasionally.',
      'Serve topped with a spoonful of Greek yogurt and fresh herbs if desired.',
    ],
    tags: ['high-protein', 'meal-prep'],
    image: require('../../assets/images/meals/meal-turkey-chili.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://www.bbcgoodfood.com/recipes/collection/healthy-dinner-recipes',
  },
  {
    id: 'tuna-avocado-wrap',
    name: 'Tuna Avocado Wrap',
    withLine: 'with greens and tomato',
    slot: 'Lunch',
    difficulty: 'easy',
    description:
      'Quick protein wrap: tuna mixed with avocado, lemon, and crisp vegetables in a whole-wheat tortilla.',
    prepMinutes: 10,
    cookMinutes: 0,
    servings: 1,
    nutrition: { calories: 410, protein: 32, carbs: 34, fat: 16, fiber: 8 },
    ingredients: [
      { name: 'Canned tuna in water, drained', amount: '1 can (5 oz)' },
      { name: 'Avocado', amount: '⅓' },
      { name: 'Whole-wheat tortilla', amount: '1 large' },
      { name: 'Mixed greens', amount: '1 cup' },
      { name: 'Tomato, sliced', amount: '½' },
      { name: 'Lemon juice', amount: '1 tsp' },
      { name: 'Dijon mustard', amount: '1 tsp' },
      { name: 'Salt & black pepper', amount: 'to taste' },
    ],
    directions: [
      'Mash avocado with lemon, mustard, salt, and pepper. Fold in drained tuna.',
      'Warm tortilla briefly if desired. Layer greens and tomato down the center.',
      'Spread tuna-avocado mixture on top, roll tightly, and slice in half.',
    ],
    tags: ['high-protein', 'quick'],
    image: require('../../assets/images/meals/meal-tuna-avocado-wrap.jpg'),
    curatedBy: 'Macronaut',
  },

  // ── New dinners ─────────────────────────────────────────────────────────
  {
    id: 'sheet-pan-chicken-fajitas',
    name: 'Sheet-Pan Chicken Fajitas',
    withLine: 'with peppers, onions, and lime',
    slot: 'Dinner',
    difficulty: 'easy',
    description:
      'One-pan fajitas: spiced chicken strips roasted with colorful peppers and onions — serve in tortillas or over rice.',
    prepMinutes: 15,
    cookMinutes: 20,
    servings: 4,
    nutrition: { calories: 380, protein: 36, carbs: 28, fat: 12, fiber: 5 },
    ingredients: [
      { name: 'Chicken breast, sliced', amount: '1½ lb' },
      { name: 'Bell peppers, sliced', amount: '3' },
      { name: 'Red onion, sliced', amount: '1' },
      { name: 'Olive oil', amount: '2 tbsp' },
      { name: 'Chili powder', amount: '2 tsp' },
      { name: 'Cumin', amount: '1 tsp' },
      { name: 'Garlic powder', amount: '1 tsp' },
      { name: 'Paprika', amount: '1 tsp' },
      { name: 'Lime', amount: '1' },
      { name: 'Whole-wheat tortillas', amount: '4 (optional)' },
    ],
    directions: [
      'Preheat oven to 425°F. Toss chicken, peppers, and onion with oil and spices on a sheet pan.',
      'Spread in a single layer and roast 18–22 minutes, tossing once, until chicken is cooked through.',
      'Squeeze lime over the pan. Serve in warm tortillas or over rice with salsa or yogurt.',
    ],
    tags: ['high-protein', 'one-pan'],
    image: require('../../assets/images/meals/meal-sheet-pan-fajitas.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://www.eatingwell.com/',
  },
  {
    id: 'baked-cod-chickpeas',
    name: 'Baked Cod with Chickpeas',
    withLine: 'with tomatoes, garlic, and herbs',
    slot: 'Dinner',
    difficulty: 'easy',
    description:
      'BBC Good Food–inspired one-pan cod baked over chickpeas, tomatoes, ginger, and spices — light and iron-rich.',
    prepMinutes: 10,
    cookMinutes: 25,
    servings: 2,
    nutrition: { calories: 340, protein: 36, carbs: 28, fat: 9, fiber: 8 },
    ingredients: [
      { name: 'Cod fillets', amount: '2 (5–6 oz each)' },
      { name: 'Chickpeas, rinsed', amount: '1 (15 oz) can' },
      { name: 'Cherry tomatoes', amount: '1½ cups' },
      { name: 'Garlic, sliced', amount: '3 cloves' },
      { name: 'Olive oil', amount: '1 tbsp' },
      { name: 'Ground cumin', amount: '1 tsp' },
      { name: 'Smoked paprika', amount: '½ tsp' },
      { name: 'Lemon', amount: '½' },
      { name: 'Fresh parsley', amount: '2 tbsp' },
      { name: 'Salt & black pepper', amount: 'to taste' },
    ],
    directions: [
      'Preheat oven to 400°F. Toss chickpeas, tomatoes, garlic, oil, cumin, and paprika in a baking dish.',
      'Nestle seasoned cod on top. Bake 18–22 minutes until fish flakes easily.',
      'Finish with lemon juice and parsley. Serve as-is or with a side of greens.',
    ],
    tags: ['high-protein', 'one-pan', 'gluten-free'],
    image: require('../../assets/images/meals/meal-baked-cod-chickpeas.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://www.bbcgoodfood.com/recipes/collection/healthy-dinner-recipes',
  },

  // ── Snacks ──────────────────────────────────────────────────────────────
  {
    id: 'protein-hummus-veg',
    name: 'Protein Hummus & Veggies',
    withLine: 'with Greek yogurt and crudités',
    slot: 'Snack',
    difficulty: 'easy',
    description:
      'Creamy chickpea hummus boosted with Greek yogurt — serve with crunchy vegetables.',
    prepMinutes: 10,
    cookMinutes: 0,
    servings: 4,
    nutrition: { calories: 180, protein: 10, carbs: 16, fat: 8, fiber: 5 },
    ingredients: [
      { name: 'Chickpeas, rinsed', amount: '1 (15 oz) can' },
      { name: 'Plain Greek yogurt', amount: '½ cup' },
      { name: 'Tahini', amount: '2 tbsp' },
      { name: 'Lemon juice', amount: '2 tbsp' },
      { name: 'Garlic', amount: '1 clove' },
      { name: 'Olive oil', amount: '1 tbsp' },
      { name: 'Cumin', amount: '½ tsp' },
      { name: 'Cucumber, carrot, bell pepper sticks', amount: '2 cups' },
    ],
    directions: [
      'Blend chickpeas, yogurt, tahini, lemon, garlic, oil, cumin, and salt until very smooth.',
      'Add cold water 1 tbsp at a time if needed for a lighter texture.',
      'Serve with vegetable sticks; drizzle with a little olive oil if desired.',
    ],
    tags: ['high-protein', 'vegetarian', 'snack'],
    image: require('../../assets/images/meals/meal-protein-hummus.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://thebalancednutritionist.com/high-protein-hummus/',
  },
  {
    id: 'pb-yogurt-energy-bites',
    name: 'PB Yogurt Energy Bites',
    withLine: 'with oats and honey',
    slot: 'Snack',
    difficulty: 'easy',
    description:
      'No-bake energy bites with peanut butter, Greek yogurt, and oats — about 5g protein each.',
    prepMinutes: 15,
    cookMinutes: 0,
    servings: 12,
    nutrition: { calories: 95, protein: 5, carbs: 10, fat: 4, fiber: 2 },
    ingredients: [
      { name: 'Natural peanut butter', amount: '½ cup' },
      { name: 'Plain Greek yogurt', amount: '⅓ cup' },
      { name: 'Honey', amount: '¼ cup' },
      { name: 'Maple syrup', amount: '2 tbsp' },
      { name: 'Rolled oats', amount: '1 cup' },
      { name: 'Ground flaxseed', amount: '¼ cup' },
      { name: 'Vanilla extract', amount: '1 tsp' },
      { name: 'Cinnamon', amount: '½ tsp' },
    ],
    directions: [
      'Mix peanut butter, yogurt, honey, maple, vanilla, cinnamon, and a pinch of salt until smooth.',
      'Stir in oats and flax until the mixture holds together.',
      'Chill 30 minutes, then roll into 1-inch balls. Refrigerate until firm.',
    ],
    tags: ['snack', 'meal-prep', 'vegetarian'],
    image: require('../../assets/images/meals/meal-energy-bites.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://www.reciperave.com/protein-balls-with-greek-yogurt/',
  },
  {
    id: 'apple-almond-butter',
    name: 'Apple & Almond Butter',
    withLine: 'with cinnamon',
    slot: 'Snack',
    difficulty: 'easy',
    description: 'Simple balanced snack: crisp apple slices with almond butter and a dusting of cinnamon.',
    prepMinutes: 3,
    cookMinutes: 0,
    servings: 1,
    nutrition: { calories: 220, protein: 6, carbs: 28, fat: 11, fiber: 6 },
    ingredients: [
      { name: 'Apple', amount: '1 medium' },
      { name: 'Almond butter', amount: '1½ tbsp' },
      { name: 'Cinnamon', amount: 'pinch' },
    ],
    directions: [
      'Slice the apple into wedges.',
      'Serve with almond butter for dipping (or drizzle on top).',
      'Dust with cinnamon.',
    ],
    tags: ['snack', 'quick', 'vegetarian'],
    image: require('../../assets/images/meals/meal-apple-almond-butter.jpg'),
    curatedBy: 'Macronaut',
  },
  {
    id: 'salty-edamame',
    name: 'Sea Salt Edamame',
    withLine: 'with lemon',
    slot: 'Snack',
    difficulty: 'easy',
    description: 'Steamed edamame pods with sea salt and lemon — plant protein in minutes.',
    prepMinutes: 2,
    cookMinutes: 5,
    servings: 1,
    nutrition: { calories: 180, protein: 17, carbs: 14, fat: 8, fiber: 8 },
    ingredients: [
      { name: 'Frozen edamame in pods', amount: '1½ cups' },
      { name: 'Sea salt', amount: 'to taste' },
      { name: 'Lemon wedge', amount: '1' },
    ],
    directions: [
      'Steam or microwave edamame according to package directions until hot.',
      'Drain, sprinkle with sea salt, and finish with a squeeze of lemon.',
      'Serve warm.',
    ],
    tags: ['snack', 'vegan', 'high-protein'],
    image: require('../../assets/images/meals/meal-edamame.jpg'),
    curatedBy: 'Macronaut',
  },
  {
    id: 'cottage-chia-pudding',
    name: 'Cottage Cheese Chia Pudding',
    withLine: 'with berries',
    slot: 'Snack',
    difficulty: 'easy',
    description:
      'Blended cottage cheese chia pudding with berries — ~22g protein, no protein powder.',
    prepMinutes: 10,
    cookMinutes: 0,
    servings: 1,
    nutrition: { calories: 280, protein: 22, carbs: 26, fat: 10, fiber: 10 },
    ingredients: [
      { name: 'Cottage cheese', amount: '1 cup' },
      { name: 'Almond milk', amount: '½ cup' },
      { name: 'Chia seeds', amount: '¼ cup' },
      { name: 'Berries', amount: '⅓ cup' },
      { name: 'Maple syrup', amount: '1 tbsp' },
      { name: 'Vanilla extract', amount: '1 tsp' },
    ],
    directions: [
      'Blend cottage cheese, milk, berries, maple, and vanilla until smooth.',
      'Stir in chia seeds, cover, and refrigerate at least 3 hours or overnight.',
      'Stir before serving; top with extra berries.',
    ],
    tags: ['snack', 'high-protein', 'meal-prep'],
    image: require('../../assets/images/meals/meal-cottage-chia-pudding.jpg'),
    curatedBy: 'Macronaut',
    sourceUrl: 'https://recipeswithcottagecheese.com/cottage-cheese-chia-pudding/',
  },
  {
    id: 'turkey-cucumber-rollups',
    name: 'Turkey Cucumber Roll-Ups',
    withLine: 'with mustard and greens',
    slot: 'Snack',
    difficulty: 'easy',
    description:
      'Low-carb protein snack: turkey slices rolled with cucumber, lettuce, and mustard.',
    prepMinutes: 8,
    cookMinutes: 0,
    servings: 1,
    nutrition: { calories: 160, protein: 24, carbs: 4, fat: 4, fiber: 1 },
    ingredients: [
      { name: 'Deli turkey breast slices', amount: '4 oz' },
      { name: 'Cucumber, matchsticks', amount: '½ cup' },
      { name: 'Lettuce leaves', amount: '4' },
      { name: 'Dijon mustard', amount: '2 tsp' },
    ],
    directions: [
      'Lay turkey slices flat and spread lightly with mustard.',
      'Add a lettuce leaf and a few cucumber sticks to each.',
      'Roll tightly and secure with a toothpick if needed. Serve chilled.',
    ],
    tags: ['snack', 'high-protein', 'low-carb'],
    image: require('../../assets/images/meals/meal-turkey-rollups.jpg'),
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
      m.difficulty,
      ...m.tags,
      ...m.ingredients.map((i) => i.name),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function mealsBySlot(
  slot: MealSlot,
  meals: CuratedMeal[] = CURATED_MEALS,
): CuratedMeal[] {
  return meals.filter((m) => m.slot === slot);
}
