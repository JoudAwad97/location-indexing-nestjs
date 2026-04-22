import { GeneratedLocation, Generator } from './generator.types';

const CATEGORIES = ['restaurant', 'cafe', 'bar', 'store', 'park'] as const;

const SF = { lat: 37.7749, lng: -122.4194 };
const SIGMA = 0.03; // ~3km

function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Tight cluster around SF for stress-testing dense-area behaviour. */
export const hotspotGenerator: Generator = function* ({ count, rng }): Iterable<GeneratedLocation> {
  for (let i = 0; i < count; i += 1) {
    const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)]!;
    yield {
      name: `SF Hotspot ${i}`,
      category,
      lat: SF.lat + gaussian(rng) * SIGMA,
      lng: SF.lng + gaussian(rng) * SIGMA,
    };
  }
};
