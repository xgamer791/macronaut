import { Nutrition } from '@/domain/types';

/** GENERATED FILE — do not edit by hand.
 *
 * Source: USDA FoodData Central, SR Legacy release 2021-10-28
 * https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2021-10-28.zip
 * Extraction: scripts/README in docs/generic-foods-validation.md
 * Traceability snapshot: docs/generic-foods-source.json
 *
 * Every value below is copied verbatim (per 100 g) from the named SR Legacy
 * record — nothing is estimated, averaged or merged across preparations.
 * Distinct preparation states are distinct entries. */

export interface VerifiedGenericFood {
  id: string;
  /** Friendly display name. */
  name: string;
  aliases: string[];
  /** Preparation / cooking state, verbatim category. */
  prep: string;
  /** USDA FoodData Central id of the exact source record. */
  fdcId: number;
  /** USDA SR NDB number. */
  ndbNumber: number;
  /** Exact SR Legacy description of the source record. */
  srDescription: string;
  /** Nutrition per 100 g, verbatim from the source record. */
  n: Nutrition;
}

export const GENERIC_FOOD_SOURCE = 'USDA FoodData Central, SR Legacy 2021-10-28';

export const VERIFIED_GENERIC_FOODS: VerifiedGenericFood[] = [
  {
    "id": "chicken-breast-raw",
    "name": "Chicken breast, skinless boneless, raw",
    "aliases": [
      "chicken breast",
      "chicken",
      "chicken tender",
      "chicken tenderloin",
      "chicken tenders"
    ],
    "prep": "raw",
    "fdcId": 171077,
    "ndbNumber": 5062,
    "srDescription": "Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw",
    "n": {
      "calories": 120,
      "fat": 2.62,
      "sodium": 45,
      "protein": 22.5,
      "cholesterol": 73,
      "sugar": 0,
      "carbs": 0,
      "fiber": 0,
      "micros": {
        "calcium": {
          "amount": 5,
          "unit": "mg"
        },
        "iron": {
          "amount": 0.37,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.811,
          "unit": "mg"
        },
        "potassium": {
          "amount": 334,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.68,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 28,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.21,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 9,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "chicken-breast-braised",
    "name": "Chicken breast, skinless boneless, cooked (braised)",
    "aliases": [
      "chicken breast cooked",
      "chicken breast",
      "grilled chicken",
      "chicken",
      "chicken tenderloin cooked"
    ],
    "prep": "cooked, braised",
    "fdcId": 171140,
    "ndbNumber": 5746,
    "srDescription": "Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised",
    "n": {
      "calories": 157,
      "fat": 3.24,
      "carbs": 0,
      "sugar": 0,
      "cholesterol": 116,
      "protein": 32.1,
      "fiber": 0,
      "sodium": 47,
      "micros": {
        "vitamin B6": {
          "amount": 0.921,
          "unit": "mg"
        },
        "calcium": {
          "amount": 6,
          "unit": "mg"
        },
        "potassium": {
          "amount": 343,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.96,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.2,
          "unit": "µg"
        },
        "iron": {
          "amount": 0.49,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 32,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 10,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "chicken-breast-grilled",
    "name": "Chicken breast, skinless boneless, grilled",
    "aliases": [
      "grilled chicken breast",
      "chicken breast grilled",
      "chicken breast",
      "chicken"
    ],
    "prep": "cooked, grilled",
    "fdcId": 171534,
    "ndbNumber": 5747,
    "srDescription": "Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, grilled",
    "n": {
      "calories": 151,
      "protein": 30.5,
      "fiber": 0,
      "sodium": 52,
      "cholesterol": 104,
      "fat": 3.17,
      "carbs": 0,
      "sugar": 0,
      "micros": {
        "iron": {
          "amount": 0.45,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 34,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.21,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin B6": {
          "amount": 1.16,
          "unit": "mg"
        },
        "calcium": {
          "amount": 5,
          "unit": "mg"
        },
        "potassium": {
          "amount": 391,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.9,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 10,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "chicken-breast-roasted",
    "name": "Chicken breast, meat only, roasted",
    "aliases": [
      "chicken breast roasted",
      "roast chicken breast"
    ],
    "prep": "cooked, roasted",
    "fdcId": 171477,
    "ndbNumber": 5064,
    "srDescription": "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
    "n": {
      "calories": 165,
      "fat": 3.57,
      "carbs": 0,
      "protein": 31,
      "fiber": 0,
      "sodium": 74,
      "cholesterol": 85,
      "sugar": 0,
      "micros": {
        "vitamin D": {
          "amount": 0.1,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 6,
          "unit": "µg"
        },
        "calcium": {
          "amount": 15,
          "unit": "mg"
        },
        "potassium": {
          "amount": 256,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.6,
          "unit": "mg"
        },
        "iron": {
          "amount": 1.04,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 29,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.34,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "chicken-thigh-raw",
    "name": "Chicken thigh, meat only, raw",
    "aliases": [
      "chicken thigh",
      "chicken thighs"
    ],
    "prep": "raw",
    "fdcId": 173627,
    "ndbNumber": 5096,
    "srDescription": "Chicken, broilers or fryers, dark meat, thigh, meat only, raw",
    "n": {
      "calories": 121,
      "fat": 4.12,
      "sodium": 95,
      "protein": 19.7,
      "cholesterol": 94,
      "sugar": 0,
      "carbs": 0,
      "fiber": 0,
      "micros": {
        "calcium": {
          "amount": 7,
          "unit": "mg"
        },
        "potassium": {
          "amount": 242,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.58,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.451,
          "unit": "mg"
        },
        "iron": {
          "amount": 0.81,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.61,
          "unit": "µg"
        },
        "magnesium": {
          "amount": 23,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 7,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "chicken-thigh-braised",
    "name": "Chicken thigh, meat only, cooked (braised)",
    "aliases": [
      "chicken thigh cooked",
      "chicken thighs"
    ],
    "prep": "cooked, braised",
    "fdcId": 172853,
    "ndbNumber": 5672,
    "srDescription": "Chicken, broilers or fryers, dark meat, thigh, meat only, cooked, braised",
    "n": {
      "calories": 176,
      "fat": 8.63,
      "carbs": 0,
      "sugar": 0,
      "protein": 24.6,
      "fiber": 0,
      "sodium": 77,
      "cholesterol": 141,
      "micros": {
        "potassium": {
          "amount": 266,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.87,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.436,
          "unit": "mg"
        },
        "calcium": {
          "amount": 12,
          "unit": "mg"
        },
        "iron": {
          "amount": 1.27,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 25,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 8,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.3,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.42,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "chicken-drumstick-raw",
    "name": "Chicken drumstick, meat only, raw",
    "aliases": [
      "chicken drumstick",
      "drumstick",
      "chicken leg"
    ],
    "prep": "raw",
    "fdcId": 173614,
    "ndbNumber": 5071,
    "srDescription": "Chicken, broilers or fryers, dark meat, drumstick, meat only, raw",
    "n": {
      "calories": 116,
      "fat": 3.71,
      "sodium": 114,
      "protein": 19.4,
      "cholesterol": 89,
      "sugar": 0,
      "fiber": 0,
      "carbs": 0,
      "micros": {
        "calcium": {
          "amount": 9,
          "unit": "mg"
        },
        "potassium": {
          "amount": 225,
          "unit": "mg"
        },
        "zinc": {
          "amount": 2.05,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.381,
          "unit": "mg"
        },
        "iron": {
          "amount": 0.76,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 20,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.51,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 7,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "chicken-drumstick-roasted",
    "name": "Chicken drumstick, meat only, roasted",
    "aliases": [
      "chicken drumstick cooked",
      "drumstick",
      "chicken leg"
    ],
    "prep": "cooked, roasted",
    "fdcId": 172376,
    "ndbNumber": 5073,
    "srDescription": "Chicken, broilers or fryers, dark meat, drumstick, meat only, cooked, roasted",
    "n": {
      "calories": 155,
      "protein": 24.2,
      "sodium": 128,
      "fat": 5.7,
      "cholesterol": 130,
      "fiber": 0,
      "carbs": 0,
      "sugar": 0,
      "micros": {
        "iron": {
          "amount": 1.14,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 22,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.38,
          "unit": "µg"
        },
        "calcium": {
          "amount": 11,
          "unit": "mg"
        },
        "potassium": {
          "amount": 256,
          "unit": "mg"
        },
        "zinc": {
          "amount": 2.56,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.407,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 6,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "chicken-wing-roasted",
    "name": "Chicken wing, meat and skin, roasted",
    "aliases": [
      "chicken wing",
      "chicken wings",
      "wings"
    ],
    "prep": "cooked, roasted",
    "fdcId": 173630,
    "ndbNumber": 5103,
    "srDescription": "Chicken, broilers or fryers, wing, meat and skin, cooked, roasted",
    "n": {
      "calories": 254,
      "fat": 16.9,
      "protein": 23.8,
      "sodium": 98,
      "cholesterol": 141,
      "fiber": 0,
      "carbs": 0,
      "sugar": 0,
      "micros": {
        "calcium": {
          "amount": 18,
          "unit": "mg"
        },
        "potassium": {
          "amount": 212,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.64,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.558,
          "unit": "mg"
        },
        "iron": {
          "amount": 0.84,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 12,
          "unit": "µg"
        },
        "vitamin B12": {
          "amount": 0.35,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.2,
          "unit": "µg"
        },
        "magnesium": {
          "amount": 19,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "ground-chicken-raw",
    "name": "Ground chicken, raw",
    "aliases": [
      "ground chicken"
    ],
    "prep": "raw",
    "fdcId": 171116,
    "ndbNumber": 5332,
    "srDescription": "Chicken, ground, raw",
    "n": {
      "calories": 143,
      "fat": 8.1,
      "sugar": 0,
      "fiber": 0,
      "sodium": 60,
      "cholesterol": 86,
      "protein": 17.4,
      "carbs": 0.04,
      "micros": {
        "calcium": {
          "amount": 6,
          "unit": "mg"
        },
        "potassium": {
          "amount": 522,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.47,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.512,
          "unit": "mg"
        },
        "iron": {
          "amount": 0.82,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 21,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.56,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ground-chicken-cooked",
    "name": "Ground chicken, cooked (pan-browned)",
    "aliases": [
      "ground chicken cooked"
    ],
    "prep": "cooked, pan-browned",
    "fdcId": 171117,
    "ndbNumber": 5333,
    "srDescription": "Chicken, ground, crumbles, cooked, pan-browned",
    "n": {
      "calories": 189,
      "cholesterol": 107,
      "protein": 23.3,
      "fiber": 0,
      "sodium": 75,
      "fat": 10.9,
      "carbs": 0,
      "sugar": 0,
      "micros": {
        "iron": {
          "amount": 0.93,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 28,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.51,
          "unit": "µg"
        },
        "calcium": {
          "amount": 8,
          "unit": "mg"
        },
        "potassium": {
          "amount": 677,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.92,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.538,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "turkey-breast-raw",
    "name": "Turkey breast, meat only, raw",
    "aliases": [
      "turkey breast",
      "turkey"
    ],
    "prep": "raw",
    "fdcId": 171098,
    "ndbNumber": 5219,
    "srDescription": "Turkey, whole, breast, meat only, raw",
    "n": {
      "calories": 114,
      "sugar": 0.05,
      "fat": 1.48,
      "protein": 23.7,
      "sodium": 113,
      "cholesterol": 57,
      "carbs": 0.14,
      "fiber": 0,
      "micros": {
        "calcium": {
          "amount": 11,
          "unit": "mg"
        },
        "potassium": {
          "amount": 242,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.28,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.813,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 6,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.1,
          "unit": "µg"
        },
        "vitamin B12": {
          "amount": 0.63,
          "unit": "µg"
        },
        "iron": {
          "amount": 0.73,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 28,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "turkey-breast-roasted",
    "name": "Turkey breast, meat only, roasted",
    "aliases": [
      "turkey breast cooked",
      "turkey",
      "roast turkey"
    ],
    "prep": "cooked, roasted",
    "fdcId": 171496,
    "ndbNumber": 5220,
    "srDescription": "Turkey, whole, breast, meat only, cooked, roasted",
    "n": {
      "calories": 147,
      "sodium": 99,
      "cholesterol": 80,
      "protein": 30.1,
      "fat": 2.08,
      "fiber": 0,
      "carbs": 0,
      "sugar": 0,
      "micros": {
        "iron": {
          "amount": 0.71,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 32,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 3,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.3,
          "unit": "µg"
        },
        "calcium": {
          "amount": 9,
          "unit": "mg"
        },
        "potassium": {
          "amount": 249,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.72,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.807,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.39,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "ground-turkey-93-raw",
    "name": "Ground turkey, 93% lean, raw",
    "aliases": [
      "ground turkey",
      "ground turkey 93"
    ],
    "prep": "raw",
    "fdcId": 172850,
    "ndbNumber": 5665,
    "srDescription": "Turkey, ground, 93% lean, 7% fat, raw",
    "n": {
      "calories": 150,
      "fiber": 0,
      "sodium": 69,
      "cholesterol": 74,
      "protein": 18.7,
      "fat": 8.34,
      "sugar": 0,
      "carbs": 0,
      "micros": {
        "iron": {
          "amount": 1.17,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 21,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 22,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.4,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 1.2,
          "unit": "µg"
        },
        "vitamin B6": {
          "amount": 0.35,
          "unit": "mg"
        },
        "calcium": {
          "amount": 21,
          "unit": "mg"
        },
        "potassium": {
          "amount": 213,
          "unit": "mg"
        },
        "zinc": {
          "amount": 2.53,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "ground-turkey-93-cooked",
    "name": "Ground turkey, 93% lean, cooked",
    "aliases": [
      "ground turkey cooked"
    ],
    "prep": "cooked, pan-broiled",
    "fdcId": 172851,
    "ndbNumber": 5666,
    "srDescription": "Turkey, ground, 93% lean, 7% fat, pan-broiled crumbles",
    "n": {
      "calories": 213,
      "sugar": 0,
      "fat": 11.6,
      "fiber": 0,
      "sodium": 90,
      "cholesterol": 104,
      "protein": 27.1,
      "carbs": 0,
      "micros": {
        "vitamin B6": {
          "amount": 0.497,
          "unit": "mg"
        },
        "calcium": {
          "amount": 31,
          "unit": "mg"
        },
        "potassium": {
          "amount": 304,
          "unit": "mg"
        },
        "zinc": {
          "amount": 3.77,
          "unit": "mg"
        },
        "iron": {
          "amount": 1.56,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 29,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 30,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.2,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 1.9,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ground-beef-97-raw",
    "name": "Ground beef, 97% lean / 3% fat, raw",
    "aliases": [
      "ground beef 97",
      "extra lean ground beef"
    ],
    "prep": "raw",
    "fdcId": 173111,
    "ndbNumber": 23477,
    "srDescription": "Beef, ground, 97% lean meat / 3% fat, raw",
    "n": {
      "calories": 121,
      "protein": 22,
      "fiber": 0,
      "sodium": 66,
      "cholesterol": 60,
      "fat": 3,
      "carbs": 0,
      "sugar": 0,
      "micros": {
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.26,
          "unit": "µg"
        },
        "iron": {
          "amount": 2.44,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 22,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.401,
          "unit": "mg"
        },
        "calcium": {
          "amount": 8,
          "unit": "mg"
        },
        "potassium": {
          "amount": 357,
          "unit": "mg"
        },
        "zinc": {
          "amount": 5.21,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 0.1,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 4,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ground-beef-93-raw",
    "name": "Ground beef, 93% lean / 7% fat, raw",
    "aliases": [
      "ground beef 93",
      "lean ground beef"
    ],
    "prep": "raw",
    "fdcId": 173110,
    "ndbNumber": 23472,
    "srDescription": "Beef, ground, 93% lean meat / 7% fat, raw",
    "n": {
      "calories": 152,
      "fat": 7,
      "carbs": 0,
      "sugar": 0,
      "cholesterol": 63,
      "protein": 20.8,
      "fiber": 0,
      "sodium": 66,
      "micros": {
        "calcium": {
          "amount": 10,
          "unit": "mg"
        },
        "potassium": {
          "amount": 336,
          "unit": "mg"
        },
        "zinc": {
          "amount": 4.97,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.383,
          "unit": "mg"
        },
        "iron": {
          "amount": 2.33,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 21,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.23,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.1,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 4,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ground-beef-90-raw",
    "name": "Ground beef, 90% lean / 10% fat, raw",
    "aliases": [
      "ground beef 90",
      "lean ground beef",
      "ground beef"
    ],
    "prep": "raw",
    "fdcId": 174030,
    "ndbNumber": 23562,
    "srDescription": "Beef, ground, 90% lean meat / 10% fat, raw",
    "n": {
      "calories": 176,
      "fat": 10,
      "carbs": 0,
      "sugar": 0,
      "protein": 20,
      "fiber": 0,
      "sodium": 66,
      "cholesterol": 65,
      "micros": {
        "potassium": {
          "amount": 321,
          "unit": "mg"
        },
        "zinc": {
          "amount": 4.79,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.369,
          "unit": "mg"
        },
        "iron": {
          "amount": 2.24,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 20,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.21,
          "unit": "µg"
        },
        "calcium": {
          "amount": 12,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 0.1,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 4,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ground-beef-85-raw",
    "name": "Ground beef, 85% lean / 15% fat, raw",
    "aliases": [
      "ground beef 85",
      "ground beef"
    ],
    "prep": "raw",
    "fdcId": 171796,
    "ndbNumber": 23567,
    "srDescription": "Beef, ground, 85% lean meat / 15% fat, raw (Includes foods for USDA's Food Distribution Program)",
    "n": {
      "calories": 215,
      "sugar": 0,
      "fiber": 0,
      "fat": 15,
      "protein": 18.6,
      "sodium": 66,
      "cholesterol": 68,
      "carbs": 0,
      "micros": {
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 0.1,
          "unit": "µg"
        },
        "calcium": {
          "amount": 15,
          "unit": "mg"
        },
        "potassium": {
          "amount": 295,
          "unit": "mg"
        },
        "zinc": {
          "amount": 4.48,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.346,
          "unit": "mg"
        },
        "iron": {
          "amount": 2.09,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 18,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.17,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 4,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ground-beef-80-raw",
    "name": "Ground beef, 80% lean / 20% fat, raw",
    "aliases": [
      "ground beef 80",
      "ground beef"
    ],
    "prep": "raw",
    "fdcId": 174036,
    "ndbNumber": 23572,
    "srDescription": "Beef, ground, 80% lean meat / 20% fat, raw",
    "n": {
      "calories": 254,
      "cholesterol": 71,
      "fiber": 0,
      "protein": 17.2,
      "fat": 20,
      "carbs": 0,
      "sugar": 0,
      "sodium": 66,
      "micros": {
        "vitamin B12": {
          "amount": 2.14,
          "unit": "µg"
        },
        "iron": {
          "amount": 1.94,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 17,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "potassium": {
          "amount": 270,
          "unit": "mg"
        },
        "zinc": {
          "amount": 4.18,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.323,
          "unit": "mg"
        },
        "calcium": {
          "amount": 18,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 0.1,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 4,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ground-beef-90-cooked",
    "name": "Ground beef, 90% lean, patty, pan-broiled",
    "aliases": [
      "ground beef cooked",
      "ground beef 90 cooked"
    ],
    "prep": "cooked, pan-broiled",
    "fdcId": 171793,
    "ndbNumber": 23564,
    "srDescription": "Beef, ground, 90% lean meat / 10% fat, patty, cooked, pan-broiled",
    "n": {
      "calories": 204,
      "fiber": 0,
      "carbs": 0,
      "sugar": 0,
      "fat": 10.7,
      "cholesterol": 84,
      "sodium": 75,
      "protein": 25.2,
      "micros": {
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.79,
          "unit": "µg"
        },
        "iron": {
          "amount": 2.77,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 23,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.379,
          "unit": "mg"
        },
        "calcium": {
          "amount": 15,
          "unit": "mg"
        },
        "potassium": {
          "amount": 363,
          "unit": "mg"
        },
        "zinc": {
          "amount": 6.33,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 3,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ground-beef-85-cooked",
    "name": "Ground beef, 85% lean, patty, pan-broiled",
    "aliases": [
      "ground beef 85 cooked",
      "burger patty"
    ],
    "prep": "cooked, pan-broiled",
    "fdcId": 174033,
    "ndbNumber": 23569,
    "srDescription": "Beef, ground, 85% lean meat / 15% fat, patty, cooked, pan-broiled",
    "n": {
      "calories": 232,
      "protein": 24.6,
      "sodium": 79,
      "carbs": 0,
      "sugar": 0,
      "fiber": 0,
      "cholesterol": 84,
      "fat": 14,
      "micros": {
        "calcium": {
          "amount": 20,
          "unit": "mg"
        },
        "potassium": {
          "amount": 349,
          "unit": "mg"
        },
        "zinc": {
          "amount": 6.2,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.367,
          "unit": "mg"
        },
        "iron": {
          "amount": 2.68,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 22,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.79,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 3,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "sirloin-steak",
    "name": "Top sirloin steak, lean, broiled",
    "aliases": [
      "sirloin",
      "sirloin steak",
      "steak"
    ],
    "prep": "cooked, broiled",
    "fdcId": 173118,
    "ndbNumber": 23629,
    "srDescription": "Beef, top sirloin, steak, separable lean only, trimmed to 1/8\" fat, choice, cooked, broiled",
    "n": {
      "calories": 187,
      "carbs": 0,
      "sugar": 0,
      "fiber": 0,
      "sodium": 61,
      "protein": 29.5,
      "fat": 6.72,
      "cholesterol": 81,
      "micros": {
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "iron": {
          "amount": 2.01,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 25,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 1.64,
          "unit": "µg"
        },
        "calcium": {
          "amount": 17,
          "unit": "mg"
        },
        "potassium": {
          "amount": 369,
          "unit": "mg"
        },
        "zinc": {
          "amount": 5.58,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.548,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 0.1,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ribeye-steak",
    "name": "Ribeye steak, boneless, lean, grilled",
    "aliases": [
      "ribeye",
      "rib eye",
      "steak"
    ],
    "prep": "cooked, grilled",
    "fdcId": 172144,
    "ndbNumber": 23176,
    "srDescription": "Beef, rib eye steak, boneless, lip off, separable lean only, trimmed to 0\" fat, choice, cooked, grilled",
    "n": {
      "calories": 215,
      "fat": 11.8,
      "carbs": 0,
      "sugar": 0,
      "protein": 27.4,
      "fiber": 0,
      "sodium": 60,
      "cholesterol": 80,
      "micros": {
        "calcium": {
          "amount": 8,
          "unit": "mg"
        },
        "potassium": {
          "amount": 282,
          "unit": "mg"
        },
        "zinc": {
          "amount": 6.97,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.514,
          "unit": "mg"
        },
        "iron": {
          "amount": 2.65,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 25,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 1,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.1,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.37,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ny-strip-steak",
    "name": "New York strip steak, lean, broiled",
    "aliases": [
      "new york strip",
      "ny strip",
      "strip steak",
      "steak"
    ],
    "prep": "cooked, broiled",
    "fdcId": 173119,
    "ndbNumber": 23630,
    "srDescription": "Beef, short loin, top loin, steak, separable lean only, trimmed to 1/8\" fat, choice, cooked, broiled",
    "n": {
      "calories": 201,
      "fiber": 0,
      "carbs": 0,
      "sugar": 0,
      "fat": 8.45,
      "sodium": 60,
      "protein": 29.2,
      "cholesterol": 84,
      "micros": {
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.607,
          "unit": "mg"
        },
        "calcium": {
          "amount": 16,
          "unit": "mg"
        },
        "potassium": {
          "amount": 362,
          "unit": "mg"
        },
        "zinc": {
          "amount": 5.47,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 1.82,
          "unit": "µg"
        },
        "iron": {
          "amount": 1.97,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 25,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "filet-mignon",
    "name": "Beef tenderloin steak (filet mignon), lean, broiled",
    "aliases": [
      "filet mignon",
      "beef tenderloin",
      "filet",
      "steak"
    ],
    "prep": "cooked, broiled",
    "fdcId": 173117,
    "ndbNumber": 23628,
    "srDescription": "Beef, tenderloin, steak, separable lean only, trimmed to 1/8\" fat, choice, cooked, broiled",
    "n": {
      "calories": 206,
      "fiber": 0,
      "carbs": 0,
      "sugar": 0,
      "protein": 29,
      "sodium": 59,
      "fat": 9.1,
      "cholesterol": 85,
      "micros": {
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "calcium": {
          "amount": 16,
          "unit": "mg"
        },
        "potassium": {
          "amount": 358,
          "unit": "mg"
        },
        "zinc": {
          "amount": 5.4,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.604,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 1.81,
          "unit": "µg"
        },
        "iron": {
          "amount": 1.95,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 24,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "flank-steak",
    "name": "Flank steak, lean, broiled",
    "aliases": [
      "flank steak",
      "flank"
    ],
    "prep": "cooked, broiled",
    "fdcId": 168611,
    "ndbNumber": 13070,
    "srDescription": "Beef, flank, steak, separable lean only, trimmed to 0\" fat, choice, cooked, broiled",
    "n": {
      "calories": 194,
      "sodium": 56,
      "protein": 27.8,
      "fat": 8.32,
      "carbs": 0,
      "sugar": 0,
      "fiber": 0,
      "cholesterol": 80,
      "micros": {
        "iron": {
          "amount": 1.84,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 23,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin B12": {
          "amount": 1.74,
          "unit": "µg"
        },
        "calcium": {
          "amount": 15,
          "unit": "mg"
        },
        "potassium": {
          "amount": 338,
          "unit": "mg"
        },
        "zinc": {
          "amount": 5.11,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.579,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "skirt-steak",
    "name": "Inside skirt steak, lean, broiled",
    "aliases": [
      "skirt steak",
      "skirt"
    ],
    "prep": "cooked, broiled",
    "fdcId": 168744,
    "ndbNumber": 13977,
    "srDescription": "Beef, plate, inside skirt steak, separable lean only, trimmed to 0\" fat, all grades, cooked, broiled",
    "n": {
      "calories": 205,
      "fat": 10.1,
      "carbs": 0,
      "protein": 26.7,
      "sodium": 76,
      "fiber": 0,
      "sugar": 0,
      "cholesterol": 85,
      "micros": {
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "iron": {
          "amount": 2.83,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 3.8,
          "unit": "µg"
        },
        "calcium": {
          "amount": 11,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.327,
          "unit": "mg"
        },
        "potassium": {
          "amount": 295,
          "unit": "mg"
        },
        "zinc": {
          "amount": 7.43,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 24,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "chuck-roast",
    "name": "Chuck arm pot roast, lean, braised",
    "aliases": [
      "chuck roast",
      "pot roast",
      "chuck"
    ],
    "prep": "cooked, braised",
    "fdcId": 171817,
    "ndbNumber": 23614,
    "srDescription": "Beef, chuck, arm pot roast, separable lean only, trimmed to 1/8\" fat, choice, cooked, braised",
    "n": {
      "calories": 224,
      "fiber": 0,
      "sugar": 0,
      "carbs": 0,
      "fat": 8.37,
      "protein": 34.7,
      "sodium": 56,
      "cholesterol": 106,
      "micros": {
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.344,
          "unit": "mg"
        },
        "calcium": {
          "amount": 15,
          "unit": "mg"
        },
        "potassium": {
          "amount": 275,
          "unit": "mg"
        },
        "zinc": {
          "amount": 8.2,
          "unit": "mg"
        },
        "iron": {
          "amount": 3.04,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 23,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.69,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.1,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "pork-chop-raw",
    "name": "Pork chop, center loin, boneless, lean, raw",
    "aliases": [
      "pork chop",
      "pork chops"
    ],
    "prep": "raw",
    "fdcId": 168263,
    "ndbNumber": 10094,
    "srDescription": "Pork, fresh, loin, center loin (chops), boneless, separable lean only, raw",
    "n": {
      "calories": 123,
      "cholesterol": 56,
      "protein": 23.8,
      "fiber": 0,
      "sodium": 87,
      "fat": 3.09,
      "carbs": 0,
      "sugar": 0,
      "micros": {
        "vitamin D": {
          "amount": 0.6,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.41,
          "unit": "µg"
        },
        "iron": {
          "amount": 0.48,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 26,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 1,
          "unit": "µg"
        },
        "vitamin B6": {
          "amount": 0.363,
          "unit": "mg"
        },
        "calcium": {
          "amount": 6,
          "unit": "mg"
        },
        "potassium": {
          "amount": 386,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.42,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "pork-chop-cooked",
    "name": "Pork chop, center loin, boneless, lean, pan-broiled",
    "aliases": [
      "pork chop cooked",
      "pork chops"
    ],
    "prep": "cooked, pan-broiled",
    "fdcId": 168285,
    "ndbNumber": 10163,
    "srDescription": "Pork, fresh, loin, center loin (chops), boneless, separable lean only, cooked, pan-broiled",
    "n": {
      "calories": 162,
      "fat": 4.65,
      "carbs": 0,
      "sugar": 0,
      "protein": 30,
      "fiber": 0,
      "sodium": 91,
      "cholesterol": 74,
      "micros": {
        "vitamin D": {
          "amount": 0.7,
          "unit": "µg"
        },
        "vitamin B6": {
          "amount": 0.383,
          "unit": "mg"
        },
        "calcium": {
          "amount": 6,
          "unit": "mg"
        },
        "potassium": {
          "amount": 407,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.75,
          "unit": "mg"
        },
        "iron": {
          "amount": 0.64,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 27,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 2,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.63,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "pork-tenderloin-raw",
    "name": "Pork tenderloin, lean, raw",
    "aliases": [
      "pork tenderloin"
    ],
    "prep": "raw",
    "fdcId": 168249,
    "ndbNumber": 10060,
    "srDescription": "Pork, fresh, loin, tenderloin, separable lean only, raw",
    "n": {
      "calories": 109,
      "sugar": 0,
      "fat": 2.17,
      "cholesterol": 65,
      "sodium": 53,
      "protein": 21,
      "carbs": 0,
      "fiber": 0,
      "micros": {
        "vitamin B6": {
          "amount": 0.777,
          "unit": "mg"
        },
        "calcium": {
          "amount": 5,
          "unit": "mg"
        },
        "potassium": {
          "amount": 399,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.89,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.51,
          "unit": "µg"
        },
        "iron": {
          "amount": 0.98,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 27,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.2,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "pork-tenderloin-roasted",
    "name": "Pork tenderloin, lean, roasted",
    "aliases": [
      "pork tenderloin cooked"
    ],
    "prep": "cooked, roasted",
    "fdcId": 168250,
    "ndbNumber": 10061,
    "srDescription": "Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted",
    "n": {
      "calories": 143,
      "sugar": 0,
      "protein": 26.2,
      "cholesterol": 73,
      "sodium": 57,
      "fat": 3.51,
      "fiber": 0,
      "carbs": 0,
      "micros": {
        "vitamin B12": {
          "amount": 0.57,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "iron": {
          "amount": 1.15,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 29,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "calcium": {
          "amount": 6,
          "unit": "mg"
        },
        "potassium": {
          "amount": 421,
          "unit": "mg"
        },
        "zinc": {
          "amount": 2.42,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.739,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 0.2,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "ham",
    "name": "Ham, boneless, extra lean, roasted",
    "aliases": [
      "ham",
      "deli ham"
    ],
    "prep": "cooked, roasted",
    "fdcId": 167871,
    "ndbNumber": 10134,
    "srDescription": "Pork, cured, ham, boneless, extra lean (approximately 5% fat), roasted",
    "n": {
      "calories": 145,
      "sugar": 0,
      "protein": 20.9,
      "cholesterol": 53,
      "fiber": 0,
      "sodium": 1200,
      "fat": 5.53,
      "carbs": 1.5,
      "micros": {
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0.8,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "iron": {
          "amount": 1.48,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 14,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.65,
          "unit": "µg"
        },
        "calcium": {
          "amount": 8,
          "unit": "mg"
        },
        "potassium": {
          "amount": 287,
          "unit": "mg"
        },
        "zinc": {
          "amount": 2.88,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.4,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "bacon",
    "name": "Bacon, cooked (baked)",
    "aliases": [
      "bacon"
    ],
    "prep": "cooked, baked",
    "fdcId": 167914,
    "ndbNumber": 10860,
    "srDescription": "Pork, cured, bacon, cooked, baked",
    "n": {
      "calories": 548,
      "fiber": 0,
      "sugar": 0,
      "protein": 35.7,
      "sodium": 2190,
      "cholesterol": 107,
      "fat": 43.3,
      "carbs": 1.35,
      "micros": {
        "vitamin A": {
          "amount": 11,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "iron": {
          "amount": 1.49,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 30,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 1.16,
          "unit": "µg"
        },
        "calcium": {
          "amount": 10,
          "unit": "mg"
        },
        "potassium": {
          "amount": 539,
          "unit": "mg"
        },
        "zinc": {
          "amount": 3.36,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.309,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "salmon-farmed",
    "name": "Salmon, Atlantic, farmed, cooked",
    "aliases": [
      "salmon"
    ],
    "prep": "cooked, dry heat",
    "fdcId": 175168,
    "ndbNumber": 15237,
    "srDescription": "Fish, salmon, Atlantic, farmed, cooked, dry heat",
    "n": {
      "calories": 206,
      "sugar": 0,
      "fat": 12.4,
      "carbs": 0,
      "protein": 22.1,
      "cholesterol": 63,
      "fiber": 0,
      "sodium": 61,
      "micros": {
        "calcium": {
          "amount": 15,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 69,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 13.1,
          "unit": "µg"
        },
        "vitamin B6": {
          "amount": 0.647,
          "unit": "mg"
        },
        "potassium": {
          "amount": 384,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.43,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 3.7,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.8,
          "unit": "µg"
        },
        "iron": {
          "amount": 0.34,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 30,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "salmon-wild",
    "name": "Salmon, Atlantic, wild, cooked",
    "aliases": [
      "wild salmon",
      "salmon"
    ],
    "prep": "cooked, dry heat",
    "fdcId": 171998,
    "ndbNumber": 15209,
    "srDescription": "Fish, salmon, Atlantic, wild, cooked, dry heat",
    "n": {
      "calories": 182,
      "protein": 25.4,
      "fiber": 0,
      "sodium": 56,
      "cholesterol": 71,
      "fat": 8.13,
      "carbs": 0,
      "micros": {
        "vitamin A": {
          "amount": 13,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 3.05,
          "unit": "µg"
        },
        "iron": {
          "amount": 1.03,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 37,
          "unit": "mg"
        },
        "calcium": {
          "amount": 15,
          "unit": "mg"
        },
        "potassium": {
          "amount": 628,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.82,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.944,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "tuna-yellowfin",
    "name": "Tuna, yellowfin, cooked",
    "aliases": [
      "tuna",
      "tuna steak",
      "ahi"
    ],
    "prep": "cooked, dry heat",
    "fdcId": 172006,
    "ndbNumber": 15221,
    "srDescription": "Fish, tuna, yellowfin, fresh, cooked, dry heat",
    "n": {
      "calories": 130,
      "cholesterol": 47,
      "protein": 29.2,
      "fiber": 0,
      "sodium": 54,
      "fat": 0.59,
      "carbs": 0,
      "sugar": 0,
      "micros": {
        "iron": {
          "amount": 0.92,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 42,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 22,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 2,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.35,
          "unit": "µg"
        },
        "calcium": {
          "amount": 4,
          "unit": "mg"
        },
        "potassium": {
          "amount": 527,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.45,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 1.04,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "tuna-canned",
    "name": "Tuna, light, canned in water, drained",
    "aliases": [
      "canned tuna",
      "tuna can",
      "tuna"
    ],
    "prep": "canned",
    "fdcId": 173709,
    "ndbNumber": 15121,
    "srDescription": "Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program)",
    "n": {
      "calories": 86,
      "sugar": 0,
      "fat": 0.96,
      "cholesterol": 36,
      "protein": 19.4,
      "sodium": 247,
      "fiber": 0,
      "carbs": 0,
      "micros": {
        "vitamin A": {
          "amount": 17,
          "unit": "µg"
        },
        "vitamin B6": {
          "amount": 0.319,
          "unit": "mg"
        },
        "calcium": {
          "amount": 17,
          "unit": "mg"
        },
        "potassium": {
          "amount": 179,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.69,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 1.2,
          "unit": "µg"
        },
        "vitamin B12": {
          "amount": 2.55,
          "unit": "µg"
        },
        "iron": {
          "amount": 1.63,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 23,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "cod",
    "name": "Cod, Atlantic, cooked",
    "aliases": [
      "cod"
    ],
    "prep": "cooked, dry heat",
    "fdcId": 171956,
    "ndbNumber": 15016,
    "srDescription": "Fish, cod, Atlantic, cooked, dry heat",
    "n": {
      "calories": 105,
      "sugar": 0,
      "fat": 0.86,
      "carbs": 0,
      "protein": 22.8,
      "fiber": 0,
      "sodium": 78,
      "cholesterol": 55,
      "micros": {
        "vitamin D": {
          "amount": 1.2,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 14,
          "unit": "µg"
        },
        "calcium": {
          "amount": 14,
          "unit": "mg"
        },
        "potassium": {
          "amount": 244,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.58,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.283,
          "unit": "mg"
        },
        "iron": {
          "amount": 0.49,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 42,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 1,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 1.05,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "tilapia",
    "name": "Tilapia, cooked",
    "aliases": [
      "tilapia"
    ],
    "prep": "cooked, dry heat",
    "fdcId": 175177,
    "ndbNumber": 15262,
    "srDescription": "Fish, tilapia, cooked, dry heat",
    "n": {
      "calories": 128,
      "cholesterol": 57,
      "protein": 26.2,
      "fiber": 0,
      "sodium": 56,
      "fat": 2.65,
      "carbs": 0,
      "sugar": 0,
      "micros": {
        "iron": {
          "amount": 0.69,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 34,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 1.86,
          "unit": "µg"
        },
        "calcium": {
          "amount": 14,
          "unit": "mg"
        },
        "potassium": {
          "amount": 380,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.41,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.123,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 3.7,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "shrimp",
    "name": "Shrimp, cooked",
    "aliases": [
      "shrimp",
      "prawns"
    ],
    "prep": "cooked, moist heat",
    "fdcId": 175180,
    "ndbNumber": 15271,
    "srDescription": "Crustaceans, shrimp, cooked",
    "n": {
      "calories": 99,
      "protein": 24,
      "sodium": 111,
      "cholesterol": 189,
      "fat": 0.28,
      "carbs": 0.2,
      "micros": {
        "iron": {
          "amount": 0.51,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 39,
          "unit": "mg"
        },
        "calcium": {
          "amount": 70,
          "unit": "mg"
        },
        "potassium": {
          "amount": 259,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.64,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "scallops",
    "name": "Scallops, steamed",
    "aliases": [
      "scallops",
      "scallop"
    ],
    "prep": "cooked, steamed",
    "fdcId": 167742,
    "ndbNumber": 90240,
    "srDescription": "Mollusks, scallop, (bay and sea), cooked, steamed",
    "n": {
      "calories": 111,
      "protein": 20.5,
      "fiber": 0,
      "sodium": 667,
      "cholesterol": 41,
      "fat": 0.84,
      "carbs": 5.41,
      "sugar": 0,
      "micros": {
        "iron": {
          "amount": 0.58,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 37,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 2,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 2.15,
          "unit": "µg"
        },
        "calcium": {
          "amount": 10,
          "unit": "mg"
        },
        "potassium": {
          "amount": 314,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.55,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.112,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "crab",
    "name": "Crab, blue, cooked",
    "aliases": [
      "crab",
      "crab meat"
    ],
    "prep": "cooked, moist heat",
    "fdcId": 174205,
    "ndbNumber": 15140,
    "srDescription": "Crustaceans, crab, blue, cooked, moist heat",
    "n": {
      "calories": 83,
      "cholesterol": 97,
      "protein": 17.9,
      "sodium": 395,
      "fat": 0.74,
      "sugar": 0,
      "fiber": 0,
      "carbs": 0,
      "micros": {
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin B12": {
          "amount": 3.33,
          "unit": "µg"
        },
        "iron": {
          "amount": 0.5,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 36,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 1,
          "unit": "µg"
        },
        "calcium": {
          "amount": 91,
          "unit": "mg"
        },
        "potassium": {
          "amount": 259,
          "unit": "mg"
        },
        "zinc": {
          "amount": 3.81,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.156,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 3.3,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "lobster",
    "name": "Lobster, northern, cooked",
    "aliases": [
      "lobster"
    ],
    "prep": "cooked, moist heat",
    "fdcId": 174209,
    "ndbNumber": 15148,
    "srDescription": "Crustaceans, lobster, northern, cooked, moist heat",
    "n": {
      "calories": 89,
      "protein": 19,
      "sodium": 486,
      "cholesterol": 146,
      "fat": 0.86,
      "carbs": 0,
      "sugar": 0,
      "fiber": 0,
      "micros": {
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "iron": {
          "amount": 0.29,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 43,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 1,
          "unit": "µg"
        },
        "vitamin B12": {
          "amount": 1.43,
          "unit": "µg"
        },
        "vitamin B6": {
          "amount": 0.119,
          "unit": "mg"
        },
        "calcium": {
          "amount": 96,
          "unit": "mg"
        },
        "potassium": {
          "amount": 230,
          "unit": "mg"
        },
        "zinc": {
          "amount": 4.05,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "egg-whole-raw",
    "name": "Egg, whole, raw",
    "aliases": [
      "egg",
      "eggs",
      "whole egg",
      "whole eggs"
    ],
    "prep": "raw",
    "fdcId": 171287,
    "ndbNumber": 1123,
    "srDescription": "Egg, whole, raw, fresh",
    "n": {
      "calories": 143,
      "cholesterol": 372,
      "protein": 12.6,
      "sodium": 142,
      "sugar": 0.37,
      "fat": 9.51,
      "carbs": 0.72,
      "fiber": 0,
      "micros": {
        "vitamin B12": {
          "amount": 0.89,
          "unit": "µg"
        },
        "iron": {
          "amount": 1.75,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 12,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 160,
          "unit": "µg"
        },
        "calcium": {
          "amount": 56,
          "unit": "mg"
        },
        "potassium": {
          "amount": 138,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.29,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.17,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 2,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "egg-hard-boiled",
    "name": "Egg, hard-boiled",
    "aliases": [
      "hard boiled egg",
      "boiled eggs",
      "egg",
      "eggs"
    ],
    "prep": "cooked, hard-boiled",
    "fdcId": 173424,
    "ndbNumber": 1129,
    "srDescription": "Egg, whole, cooked, hard-boiled",
    "n": {
      "calories": 155,
      "sugar": 1.12,
      "fiber": 0,
      "cholesterol": 373,
      "protein": 12.6,
      "sodium": 124,
      "fat": 10.6,
      "carbs": 1.12,
      "micros": {
        "vitamin B6": {
          "amount": 0.121,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 149,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 2.2,
          "unit": "µg"
        },
        "iron": {
          "amount": 1.19,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 10,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 1.11,
          "unit": "µg"
        },
        "calcium": {
          "amount": 50,
          "unit": "mg"
        },
        "potassium": {
          "amount": 126,
          "unit": "mg"
        },
        "zinc": {
          "amount": 1.05,
          "unit": "mg"
        }
      }
    }
  },
  {
    "id": "egg-whites",
    "name": "Egg whites, raw",
    "aliases": [
      "egg white",
      "egg whites",
      "liquid egg whites"
    ],
    "prep": "raw",
    "fdcId": 172183,
    "ndbNumber": 1124,
    "srDescription": "Egg, white, raw, fresh",
    "n": {
      "calories": 52,
      "fiber": 0,
      "sugar": 0.71,
      "sodium": 166,
      "protein": 10.9,
      "fat": 0.17,
      "cholesterol": 0,
      "carbs": 0.73,
      "micros": {
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0.09,
          "unit": "µg"
        },
        "iron": {
          "amount": 0.08,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 11,
          "unit": "mg"
        },
        "calcium": {
          "amount": 7,
          "unit": "mg"
        },
        "potassium": {
          "amount": 163,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.03,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.005,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "white-rice-cooked",
    "name": "White rice, long-grain, cooked",
    "aliases": [
      "white rice",
      "rice"
    ],
    "prep": "cooked",
    "fdcId": 169753,
    "ndbNumber": 20345,
    "srDescription": "Rice, white, long-grain, regular, cooked, enriched, with salt",
    "n": {
      "calories": 130,
      "sugar": 0.05,
      "protein": 2.69,
      "fiber": 0.4,
      "sodium": 382,
      "cholesterol": 0,
      "fat": 0.28,
      "carbs": 28.2,
      "micros": {
        "iron": {
          "amount": 1.2,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 12,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "calcium": {
          "amount": 10,
          "unit": "mg"
        },
        "potassium": {
          "amount": 35,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.49,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.093,
          "unit": "mg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "brown-rice-cooked",
    "name": "Brown rice, long-grain, cooked",
    "aliases": [
      "brown rice",
      "rice"
    ],
    "prep": "cooked",
    "fdcId": 169704,
    "ndbNumber": 20037,
    "srDescription": "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)",
    "n": {
      "calories": 123,
      "fiber": 1.6,
      "sodium": 4,
      "protein": 2.74,
      "fat": 0.97,
      "carbs": 25.6,
      "sugar": 0.24,
      "cholesterol": 0,
      "micros": {
        "iron": {
          "amount": 0.56,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 39,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.123,
          "unit": "mg"
        },
        "calcium": {
          "amount": 3,
          "unit": "mg"
        },
        "potassium": {
          "amount": 86,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.71,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "oats-dry",
    "name": "Oats, regular and quick, dry",
    "aliases": [
      "oats",
      "oatmeal",
      "rolled oats"
    ],
    "prep": "dry",
    "fdcId": 173904,
    "ndbNumber": 8120,
    "srDescription": "Cereals, oats, regular and quick, not fortified, dry",
    "n": {
      "calories": 379,
      "cholesterol": 0,
      "fiber": 10.1,
      "sugar": 0.99,
      "fat": 6.52,
      "carbs": 67.7,
      "sodium": 6,
      "protein": 13.2,
      "micros": {
        "vitamin C": {
          "amount": 0,
          "unit": "mg"
        },
        "iron": {
          "amount": 4.25,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 138,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.1,
          "unit": "mg"
        },
        "potassium": {
          "amount": 362,
          "unit": "mg"
        },
        "zinc": {
          "amount": 3.64,
          "unit": "mg"
        },
        "calcium": {
          "amount": 52,
          "unit": "mg"
        },
        "vitamin A": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin B12": {
          "amount": 0,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "potato-baked",
    "name": "Potato, baked, flesh and skin",
    "aliases": [
      "potato",
      "baked potato"
    ],
    "prep": "cooked, baked",
    "fdcId": 170093,
    "ndbNumber": 11674,
    "srDescription": "Potatoes, baked, flesh and skin, without salt",
    "n": {
      "calories": 93,
      "fiber": 2.2,
      "sodium": 10,
      "protein": 2.5,
      "fat": 0.13,
      "cholesterol": 0,
      "carbs": 21.2,
      "sugar": 1.18,
      "micros": {
        "vitamin A": {
          "amount": 1,
          "unit": "µg"
        },
        "iron": {
          "amount": 1.08,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 28,
          "unit": "mg"
        },
        "vitamin C": {
          "amount": 9.6,
          "unit": "mg"
        },
        "calcium": {
          "amount": 15,
          "unit": "mg"
        },
        "potassium": {
          "amount": 535,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.36,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.311,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        }
      }
    }
  },
  {
    "id": "sweet-potato-baked",
    "name": "Sweet potato, baked in skin",
    "aliases": [
      "sweet potato"
    ],
    "prep": "cooked, baked",
    "fdcId": 168483,
    "ndbNumber": 11508,
    "srDescription": "Sweet potato, cooked, baked in skin, flesh, without salt",
    "n": {
      "calories": 90,
      "carbs": 20.7,
      "sodium": 36,
      "fat": 0.15,
      "sugar": 6.48,
      "cholesterol": 0,
      "fiber": 3.3,
      "protein": 2.01,
      "micros": {
        "vitamin A": {
          "amount": 961,
          "unit": "µg"
        },
        "iron": {
          "amount": 0.69,
          "unit": "mg"
        },
        "magnesium": {
          "amount": 27,
          "unit": "mg"
        },
        "calcium": {
          "amount": 38,
          "unit": "mg"
        },
        "potassium": {
          "amount": 475,
          "unit": "mg"
        },
        "zinc": {
          "amount": 0.32,
          "unit": "mg"
        },
        "vitamin B12": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin D": {
          "amount": 0,
          "unit": "µg"
        },
        "vitamin C": {
          "amount": 19.6,
          "unit": "mg"
        },
        "vitamin B6": {
          "amount": 0.286,
          "unit": "mg"
        }
      }
    }
  }
];
