import seedrandom from 'seedrandom';

export type Rng = seedrandom.PRNG;

export interface GeneratedLocation {
  name: string;
  category: string;
  lat: number;
  lng: number;
}

export type Distribution = 'uniform' | 'city-cluster' | 'hotspot';

export interface GeneratorOptions {
  count: number;
  rng: Rng;
}

export type Generator = (opts: GeneratorOptions) => Iterable<GeneratedLocation>;
