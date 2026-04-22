import { QtBounds, QtItem } from './types';

/**
 * A quadtree node. Each node owns a rectangular region. If it holds more than
 * `leafCapacity` items, it splits into four equal sub-quadrants (NW, NE, SW, SE)
 * and re-distributes its items into them. Internal nodes hold no items directly.
 *
 * Memory cost (from article §5):
 *   - Internal node: ~64 bytes (bbox + 4 child pointers)
 *   - Leaf node with capacity 100: ~832 bytes (bbox + up to 100 ids)
 */
export class QuadtreeNode {
  children: [QuadtreeNode, QuadtreeNode, QuadtreeNode, QuadtreeNode] | null = null;
  items: QtItem[] = [];

  constructor(readonly bounds: QtBounds) {}

  contains(lat: number, lng: number): boolean {
    return (
      lat >= this.bounds.minLat &&
      lat <= this.bounds.maxLat &&
      lng >= this.bounds.minLng &&
      lng <= this.bounds.maxLng
    );
  }

  subdivide(): void {
    const { minLat, maxLat, minLng, maxLng } = this.bounds;
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    this.children = [
      new QuadtreeNode({ minLat: midLat, maxLat, minLng, maxLng: midLng }), // NW
      new QuadtreeNode({ minLat: midLat, maxLat, minLng: midLng, maxLng }), // NE
      new QuadtreeNode({ minLat, maxLat: midLat, minLng, maxLng: midLng }), // SW
      new QuadtreeNode({ minLat, maxLat: midLat, minLng: midLng, maxLng }), // SE
    ];
  }

  intersects(bbox: QtBounds): boolean {
    return !(
      bbox.minLat > this.bounds.maxLat ||
      bbox.maxLat < this.bounds.minLat ||
      bbox.minLng > this.bounds.maxLng ||
      bbox.maxLng < this.bounds.minLng
    );
  }
}
