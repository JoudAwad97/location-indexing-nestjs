import { LocationInput, LocationRecord, NearbyResult } from './location.types';

export interface ProximityStrategy {
  readonly name: string;

  insert(loc: LocationInput): Promise<LocationRecord>;
  findById(id: string): Promise<LocationRecord | null>;
  findNearby(q: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit?: number;
    minResults?: number;
  }): Promise<NearbyResult>;
}
