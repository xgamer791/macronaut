# Generic food database — validation report

Generated 2026-07-14 · Source: **USDA FoodData Central, SR Legacy release 2021-10-28**
(https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2021-10-28.zip)

Every entry below was extracted verbatim from the named SR Legacy record — no value is
estimated, averaged, or merged across preparation methods. Distinct preparations are
distinct entries. The committed snapshot (docs/generic-foods-source.json) plus the Jest
suite (genericFoodsVerification.test.ts) re-verify this on every CI run: verbatim
per-100 g match against the source, and exact scaling at 100 g / 150 g / 250 g / 500 g / 1 lb.

Scaling is always computed from the exact per-100 g source profile — display rounding
happens only at render time.

| Entry | Preparation | FDC ID | NDB | kcal/100g | P | C | F | kcal @150g | @250g | @500g | @1lb | Verified |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Chicken breast, skinless boneless, raw | raw | [171077](https://fdc.nal.usda.gov/food-details/171077/nutrients) | 5062 | 120 | 22.5 | 0 | 2.62 | 180 | 300 | 600 | 544.3 | ✓ verbatim |
| Chicken breast, skinless boneless, cooked (braised) | cooked, braised | [171140](https://fdc.nal.usda.gov/food-details/171140/nutrients) | 5746 | 157 | 32.1 | 0 | 3.24 | 235.5 | 392.5 | 785 | 712.1 | ✓ verbatim |
| Chicken breast, skinless boneless, grilled | cooked, grilled | [171534](https://fdc.nal.usda.gov/food-details/171534/nutrients) | 5747 | 151 | 30.5 | 0 | 3.17 | 226.5 | 377.5 | 755 | 684.9 | ✓ verbatim |
| Chicken breast, meat only, roasted | cooked, roasted | [171477](https://fdc.nal.usda.gov/food-details/171477/nutrients) | 5064 | 165 | 31 | 0 | 3.57 | 247.5 | 412.5 | 825 | 748.4 | ✓ verbatim |
| Chicken thigh, meat only, raw | raw | [173627](https://fdc.nal.usda.gov/food-details/173627/nutrients) | 5096 | 121 | 19.7 | 0 | 4.12 | 181.5 | 302.5 | 605 | 548.8 | ✓ verbatim |
| Chicken thigh, meat only, cooked (braised) | cooked, braised | [172853](https://fdc.nal.usda.gov/food-details/172853/nutrients) | 5672 | 176 | 24.6 | 0 | 8.63 | 264 | 440 | 880 | 798.3 | ✓ verbatim |
| Chicken drumstick, meat only, raw | raw | [173614](https://fdc.nal.usda.gov/food-details/173614/nutrients) | 5071 | 116 | 19.4 | 0 | 3.71 | 174 | 290 | 580 | 526.2 | ✓ verbatim |
| Chicken drumstick, meat only, roasted | cooked, roasted | [172376](https://fdc.nal.usda.gov/food-details/172376/nutrients) | 5073 | 155 | 24.2 | 0 | 5.7 | 232.5 | 387.5 | 775 | 703.1 | ✓ verbatim |
| Chicken wing, meat and skin, roasted | cooked, roasted | [173630](https://fdc.nal.usda.gov/food-details/173630/nutrients) | 5103 | 254 | 23.8 | 0 | 16.9 | 381 | 635 | 1270 | 1152.1 | ✓ verbatim |
| Ground chicken, raw | raw | [171116](https://fdc.nal.usda.gov/food-details/171116/nutrients) | 5332 | 143 | 17.4 | 0.04 | 8.1 | 214.5 | 357.5 | 715 | 648.6 | ✓ verbatim |
| Ground chicken, cooked (pan-browned) | cooked, pan-browned | [171117](https://fdc.nal.usda.gov/food-details/171117/nutrients) | 5333 | 189 | 23.3 | 0 | 10.9 | 283.5 | 472.5 | 945 | 857.3 | ✓ verbatim |
| Turkey breast, meat only, raw | raw | [171098](https://fdc.nal.usda.gov/food-details/171098/nutrients) | 5219 | 114 | 23.7 | 0.14 | 1.48 | 171 | 285 | 570 | 517.1 | ✓ verbatim |
| Turkey breast, meat only, roasted | cooked, roasted | [171496](https://fdc.nal.usda.gov/food-details/171496/nutrients) | 5220 | 147 | 30.1 | 0 | 2.08 | 220.5 | 367.5 | 735 | 666.8 | ✓ verbatim |
| Ground turkey, 93% lean, raw | raw | [172850](https://fdc.nal.usda.gov/food-details/172850/nutrients) | 5665 | 150 | 18.7 | 0 | 8.34 | 225 | 375 | 750 | 680.4 | ✓ verbatim |
| Ground turkey, 93% lean, cooked | cooked, pan-broiled | [172851](https://fdc.nal.usda.gov/food-details/172851/nutrients) | 5666 | 213 | 27.1 | 0 | 11.6 | 319.5 | 532.5 | 1065 | 966.2 | ✓ verbatim |
| Ground beef, 97% lean / 3% fat, raw | raw | [173111](https://fdc.nal.usda.gov/food-details/173111/nutrients) | 23477 | 121 | 22 | 0 | 3 | 181.5 | 302.5 | 605 | 548.8 | ✓ verbatim |
| Ground beef, 93% lean / 7% fat, raw | raw | [173110](https://fdc.nal.usda.gov/food-details/173110/nutrients) | 23472 | 152 | 20.8 | 0 | 7 | 228 | 380 | 760 | 689.5 | ✓ verbatim |
| Ground beef, 90% lean / 10% fat, raw | raw | [174030](https://fdc.nal.usda.gov/food-details/174030/nutrients) | 23562 | 176 | 20 | 0 | 10 | 264 | 440 | 880 | 798.3 | ✓ verbatim |
| Ground beef, 85% lean / 15% fat, raw | raw | [171796](https://fdc.nal.usda.gov/food-details/171796/nutrients) | 23567 | 215 | 18.6 | 0 | 15 | 322.5 | 537.5 | 1075 | 975.2 | ✓ verbatim |
| Ground beef, 80% lean / 20% fat, raw | raw | [174036](https://fdc.nal.usda.gov/food-details/174036/nutrients) | 23572 | 254 | 17.2 | 0 | 20 | 381 | 635 | 1270 | 1152.1 | ✓ verbatim |
| Ground beef, 90% lean, patty, pan-broiled | cooked, pan-broiled | [171793](https://fdc.nal.usda.gov/food-details/171793/nutrients) | 23564 | 204 | 25.2 | 0 | 10.7 | 306 | 510 | 1020 | 925.3 | ✓ verbatim |
| Ground beef, 85% lean, patty, pan-broiled | cooked, pan-broiled | [174033](https://fdc.nal.usda.gov/food-details/174033/nutrients) | 23569 | 232 | 24.6 | 0 | 14 | 348 | 580 | 1160 | 1052.3 | ✓ verbatim |
| Top sirloin steak, lean, broiled | cooked, broiled | [173118](https://fdc.nal.usda.gov/food-details/173118/nutrients) | 23629 | 187 | 29.5 | 0 | 6.72 | 280.5 | 467.5 | 935 | 848.2 | ✓ verbatim |
| Ribeye steak, boneless, lean, grilled | cooked, grilled | [172144](https://fdc.nal.usda.gov/food-details/172144/nutrients) | 23176 | 215 | 27.4 | 0 | 11.8 | 322.5 | 537.5 | 1075 | 975.2 | ✓ verbatim |
| New York strip steak, lean, broiled | cooked, broiled | [173119](https://fdc.nal.usda.gov/food-details/173119/nutrients) | 23630 | 201 | 29.2 | 0 | 8.45 | 301.5 | 502.5 | 1005 | 911.7 | ✓ verbatim |
| Beef tenderloin steak (filet mignon), lean, broiled | cooked, broiled | [173117](https://fdc.nal.usda.gov/food-details/173117/nutrients) | 23628 | 206 | 29 | 0 | 9.1 | 309 | 515 | 1030 | 934.4 | ✓ verbatim |
| Flank steak, lean, broiled | cooked, broiled | [168611](https://fdc.nal.usda.gov/food-details/168611/nutrients) | 13070 | 194 | 27.8 | 0 | 8.32 | 291 | 485 | 970 | 880 | ✓ verbatim |
| Inside skirt steak, lean, broiled | cooked, broiled | [168744](https://fdc.nal.usda.gov/food-details/168744/nutrients) | 13977 | 205 | 26.7 | 0 | 10.1 | 307.5 | 512.5 | 1025 | 929.9 | ✓ verbatim |
| Chuck arm pot roast, lean, braised | cooked, braised | [171817](https://fdc.nal.usda.gov/food-details/171817/nutrients) | 23614 | 224 | 34.7 | 0 | 8.37 | 336 | 560 | 1120 | 1016 | ✓ verbatim |
| Pork chop, center loin, boneless, lean, raw | raw | [168263](https://fdc.nal.usda.gov/food-details/168263/nutrients) | 10094 | 123 | 23.8 | 0 | 3.09 | 184.5 | 307.5 | 615 | 557.9 | ✓ verbatim |
| Pork chop, center loin, boneless, lean, pan-broiled | cooked, pan-broiled | [168285](https://fdc.nal.usda.gov/food-details/168285/nutrients) | 10163 | 162 | 30 | 0 | 4.65 | 243 | 405 | 810 | 734.8 | ✓ verbatim |
| Pork tenderloin, lean, raw | raw | [168249](https://fdc.nal.usda.gov/food-details/168249/nutrients) | 10060 | 109 | 21 | 0 | 2.17 | 163.5 | 272.5 | 545 | 494.4 | ✓ verbatim |
| Pork tenderloin, lean, roasted | cooked, roasted | [168250](https://fdc.nal.usda.gov/food-details/168250/nutrients) | 10061 | 143 | 26.2 | 0 | 3.51 | 214.5 | 357.5 | 715 | 648.6 | ✓ verbatim |
| Ham, boneless, extra lean, roasted | cooked, roasted | [167871](https://fdc.nal.usda.gov/food-details/167871/nutrients) | 10134 | 145 | 20.9 | 1.5 | 5.53 | 217.5 | 362.5 | 725 | 657.7 | ✓ verbatim |
| Bacon, cooked (baked) | cooked, baked | [167914](https://fdc.nal.usda.gov/food-details/167914/nutrients) | 10860 | 548 | 35.7 | 1.35 | 43.3 | 822 | 1370 | 2740 | 2485.7 | ✓ verbatim |
| Salmon, Atlantic, farmed, cooked | cooked, dry heat | [175168](https://fdc.nal.usda.gov/food-details/175168/nutrients) | 15237 | 206 | 22.1 | 0 | 12.4 | 309 | 515 | 1030 | 934.4 | ✓ verbatim |
| Salmon, Atlantic, wild, cooked | cooked, dry heat | [171998](https://fdc.nal.usda.gov/food-details/171998/nutrients) | 15209 | 182 | 25.4 | 0 | 8.13 | 273 | 455 | 910 | 825.5 | ✓ verbatim |
| Tuna, yellowfin, cooked | cooked, dry heat | [172006](https://fdc.nal.usda.gov/food-details/172006/nutrients) | 15221 | 130 | 29.2 | 0 | 0.59 | 195 | 325 | 650 | 589.7 | ✓ verbatim |
| Tuna, light, canned in water, drained | canned | [173709](https://fdc.nal.usda.gov/food-details/173709/nutrients) | 15121 | 86 | 19.4 | 0 | 0.96 | 129 | 215 | 430 | 390.1 | ✓ verbatim |
| Cod, Atlantic, cooked | cooked, dry heat | [171956](https://fdc.nal.usda.gov/food-details/171956/nutrients) | 15016 | 105 | 22.8 | 0 | 0.86 | 157.5 | 262.5 | 525 | 476.3 | ✓ verbatim |
| Tilapia, cooked | cooked, dry heat | [175177](https://fdc.nal.usda.gov/food-details/175177/nutrients) | 15262 | 128 | 26.2 | 0 | 2.65 | 192 | 320 | 640 | 580.6 | ✓ verbatim |
| Shrimp, cooked | cooked, moist heat | [175180](https://fdc.nal.usda.gov/food-details/175180/nutrients) | 15271 | 99 | 24 | 0.2 | 0.28 | 148.5 | 247.5 | 495 | 449.1 | ✓ verbatim |
| Scallops, steamed | cooked, steamed | [167742](https://fdc.nal.usda.gov/food-details/167742/nutrients) | 90240 | 111 | 20.5 | 5.41 | 0.84 | 166.5 | 277.5 | 555 | 503.5 | ✓ verbatim |
| Crab, blue, cooked | cooked, moist heat | [174205](https://fdc.nal.usda.gov/food-details/174205/nutrients) | 15140 | 83 | 17.9 | 0 | 0.74 | 124.5 | 207.5 | 415 | 376.5 | ✓ verbatim |
| Lobster, northern, cooked | cooked, moist heat | [174209](https://fdc.nal.usda.gov/food-details/174209/nutrients) | 15148 | 89 | 19 | 0 | 0.86 | 133.5 | 222.5 | 445 | 403.7 | ✓ verbatim |
| Egg, whole, raw | raw | [171287](https://fdc.nal.usda.gov/food-details/171287/nutrients) | 1123 | 143 | 12.6 | 0.72 | 9.51 | 214.5 | 357.5 | 715 | 648.6 | ✓ verbatim |
| Egg, hard-boiled | cooked, hard-boiled | [173424](https://fdc.nal.usda.gov/food-details/173424/nutrients) | 1129 | 155 | 12.6 | 1.12 | 10.6 | 232.5 | 387.5 | 775 | 703.1 | ✓ verbatim |
| Egg whites, raw | raw | [172183](https://fdc.nal.usda.gov/food-details/172183/nutrients) | 1124 | 52 | 10.9 | 0.73 | 0.17 | 78 | 130 | 260 | 235.9 | ✓ verbatim |
| White rice, long-grain, cooked | cooked | [169753](https://fdc.nal.usda.gov/food-details/169753/nutrients) | 20345 | 130 | 2.69 | 28.2 | 0.28 | 195 | 325 | 650 | 589.7 | ✓ verbatim |
| Brown rice, long-grain, cooked | cooked | [169704](https://fdc.nal.usda.gov/food-details/169704/nutrients) | 20037 | 123 | 2.74 | 25.6 | 0.97 | 184.5 | 307.5 | 615 | 557.9 | ✓ verbatim |
| Oats, regular and quick, dry | dry | [173904](https://fdc.nal.usda.gov/food-details/173904/nutrients) | 8120 | 379 | 13.2 | 67.7 | 6.52 | 568.5 | 947.5 | 1895 | 1719.1 | ✓ verbatim |
| Potato, baked, flesh and skin | cooked, baked | [170093](https://fdc.nal.usda.gov/food-details/170093/nutrients) | 11674 | 93 | 2.5 | 21.2 | 0.13 | 139.5 | 232.5 | 465 | 421.8 | ✓ verbatim |
| Sweet potato, baked in skin | cooked, baked | [168483](https://fdc.nal.usda.gov/food-details/168483/nutrients) | 11508 | 90 | 2.01 | 20.7 | 0.15 | 135 | 225 | 450 | 408.2 | ✓ verbatim |

## Spot check — the reported case

11 oz (311.84 g) of *Chicken breast, skinless boneless, cooked (braised)* (FDC 171140,
157 kcal / 32.1 g protein / 3.24 g fat per 100 g):

- Calories: 157 × 3.1184 = **489.6 kcal**
- Protein: 32.1 × 3.1184 = **100.1 g**
- Fat: 3.24 × 3.1184 = **10.1 g**

Matches the authoritative scaling exactly (asserted in the test suite).
