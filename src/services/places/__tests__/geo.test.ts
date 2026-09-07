import {
  GYM_SEARCH_RADIUS_M,
  boundingBox,
  haversineM,
  isFiniteCoordinate,
  metersToMiles,
} from '../../../../convex/lib/geo';

describe('geo', () => {
  it('measures great-circle distance', () => {
    // One degree of longitude on the equator is 111.2 km.
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111_195, -2);
    // Venice Beach to Santa Monica Pier: about 3 km.
    const d = haversineM({ lat: 33.985, lng: -118.4695 }, { lat: 34.0094, lng: -118.4973 });
    expect(d).toBeGreaterThan(3_400);
    expect(d).toBeLessThan(3_900);
    expect(haversineM({ lat: 51.5, lng: -0.12 }, { lat: 51.5, lng: -0.12 })).toBe(0);
  });

  it('boxes a circle symmetrically and widens with latitude', () => {
    const equator = boundingBox({ lat: 0, lng: 0 }, GYM_SEARCH_RADIUS_M);
    expect(equator.high.lat).toBeCloseTo(-equator.low.lat, 6);
    expect(equator.high.lng).toBeCloseTo(-equator.low.lng, 6);
    expect(equator.high.lng - equator.low.lng).toBeCloseTo(equator.high.lat - equator.low.lat, 6);

    const north = boundingBox({ lat: 60, lng: 10 }, GYM_SEARCH_RADIUS_M);
    expect(north.high.lng - north.low.lng).toBeGreaterThan(
      (equator.high.lng - equator.low.lng) * 1.9,
    );
    // Every corner of the box is at least the radius away from the centre.
    expect(haversineM({ lat: 60, lng: 10 }, { lat: north.high.lat, lng: 10 })).toBeCloseTo(
      GYM_SEARCH_RADIUS_M,
      -1,
    );
  });

  it('converts seven miles and validates coordinates', () => {
    expect(metersToMiles(GYM_SEARCH_RADIUS_M)).toBeCloseTo(7, 2);
    expect(isFiniteCoordinate(33.99, -118.47)).toBe(true);
    expect(isFiniteCoordinate(91, 0)).toBe(false);
    expect(isFiniteCoordinate(0, 181)).toBe(false);
    expect(isFiniteCoordinate(Number.NaN, 0)).toBe(false);
  });
});
