import {
  getRestaurantFood,
  listRestaurants,
  restaurantMatchScore,
  searchRestaurantFoods,
} from '../restaurantFoods';
import { RESTAURANT_FOODS } from '../restaurantFoods.data';

describe('restaurantFoods', () => {
  it('bundles major US chains with verified nutrition', () => {
    const restaurants = listRestaurants();
    for (const required of ["McDonald's", 'Chipotle', 'Starbucks', 'Subway', 'Chick-fil-A', 'Taco Bell']) {
      expect(restaurants).toContain(required);
    }
    expect(RESTAURANT_FOODS.length).toBeGreaterThanOrEqual(40);
    for (const e of RESTAURANT_FOODS) {
      expect(e.calories).toBeGreaterThanOrEqual(0);
      expect(e.protein).toBeGreaterThanOrEqual(0);
      expect(e.dateVerified).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(e.source.length).toBeGreaterThan(3);
    }
  });

  it('searches by restaurant and menu item without inventing data', () => {
    const bigMac = searchRestaurantFoods('big mac');
    expect(bigMac[0].name).toContain('Big Mac');
    expect(bigMac[0].provider).toBe('restaurant');
    expect(bigMac[0].verified).toBe(true);
    expect(bigMac[0].category).toBe('restaurant');
    expect(bigMac[0].nutritionPerServing?.calories).toBe(590);

    const chipotle = searchRestaurantFoods('chipotle chicken');
    expect(chipotle.some((f) => f.restaurant === 'Chipotle')).toBe(true);

    expect(searchRestaurantFoods('xyzzy-not-a-food')).toEqual([]);
  });

  it('loads by id', () => {
    const f = getRestaurantFood('mcd-big-mac');
    expect(f?.restaurant).toBe("McDonald's");
    expect(f?.gramsPerServing).toBe(215);
  });

  it('scores exact aliases highly', () => {
    const entry = RESTAURANT_FOODS.find((e) => e.id === 'mcd-big-mac')!;
    expect(restaurantMatchScore('bigmac', entry)).toBeGreaterThanOrEqual(90);
  });
});
