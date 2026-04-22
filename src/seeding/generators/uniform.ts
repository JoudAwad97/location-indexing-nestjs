import { GeneratedLocation, Generator } from './generator.types';

const CATEGORIES = ['restaurant', 'cafe', 'bar', 'store', 'park'] as const;

/** Uniformly distributed across the populated lat band and full lng range. */
export const uniformGenerator: Generator = function* ({ count, rng }): Iterable<GeneratedLocation> {
  for (let i = 0; i < count; i += 1) {
    const lat = rng() * 120 - 60; // -60..60 — where people actually live
    const lng = rng() * 360 - 180;
    const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)]!;
    yield {
      name: `Uniform POI ${i}`,
      category,
      lat,
      lng,
    };
  }
};
