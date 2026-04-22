import { GeneratedLocation, Generator } from './generator.types';

interface City {
  name: string;
  lat: number;
  lng: number;
  /** Cluster stddev in degrees — ~0.05 ≈ 5km */
  sigma: number;
  weight: number;
}

const CITIES: City[] = [
  { name: 'SF', lat: 37.7749, lng: -122.4194, sigma: 0.05, weight: 0.25 },
  { name: 'NYC', lat: 40.7128, lng: -74.006, sigma: 0.05, weight: 0.25 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, sigma: 0.05, weight: 0.2 },
  { name: 'Berlin', lat: 52.52, lng: 13.405, sigma: 0.05, weight: 0.2 },
];

const CATEGORIES = ['restaurant', 'cafe', 'bar', 'store', 'park'] as const;

/** Box-Muller: turn two uniform samples into one Gaussian sample. */
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function pickCity(rng: () => number): City | null {
  const r = rng();
  let acc = 0;
  for (const c of CITIES) {
    acc += c.weight;
    if (r <= acc) return c;
  }
  return null; // remaining weight → sparse fill
}

/**
 * City-cluster distribution:
 * - 90% of rows clustered around 4 major cities with Gaussian spread
 * - 10% sparse fill across populated lat band to exercise long-tail behaviour
 */
export const cityClusterGenerator: Generator = function* ({
  count,
  rng,
}): Iterable<GeneratedLocation> {
  for (let i = 0; i < count; i += 1) {
    const city = pickCity(rng);
    const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)]!;

    if (city) {
      const lat = city.lat + gaussian(rng) * city.sigma;
      const lng = city.lng + gaussian(rng) * city.sigma;
      yield { name: `${city.name} POI ${i}`, category, lat, lng };
    } else {
      const lat = rng() * 120 - 60;
      const lng = rng() * 360 - 180;
      yield { name: `Sparse POI ${i}`, category, lat, lng };
    }
  }
};
