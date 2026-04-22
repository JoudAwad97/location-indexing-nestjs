export interface QtBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface QtItem {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  createdAt: Date;
}
