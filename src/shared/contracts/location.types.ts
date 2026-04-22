export interface LocationInput {
  name: string;
  category: string;
  lat: number;
  lng: number;
}

export interface LocationRecord extends LocationInput {
  id: string;
  createdAt: Date;
}

export interface NearbyDiagnostics {
  cellsQueried: number;
  expansionSteps: number;
  dbRowsExamined?: number;
  latencyMs: number;
  notes?: Record<string, unknown>;
}

export interface NearbyResult {
  strategy: string;
  results: Array<LocationRecord & { distanceMeters: number }>;
  diagnostics: NearbyDiagnostics;
}
