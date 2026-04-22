import { QuadtreeNode } from './node';
import { QtBounds, QtItem } from './types';

export interface BuildStats {
  itemCount: number;
  leafCount: number;
  internalCount: number;
  maxDepth: number;
  buildMs: number;
}

/**
 * Build a quadtree by streaming items and inserting one at a time.
 *
 * Article §5: recursive subdivide when a leaf exceeds `leafCapacity`.
 * We keep insert iterative to avoid deep JS call stacks on millions of items.
 */
export function buildQuadtree(
  rootBounds: QtBounds,
  items: Iterable<QtItem>,
  leafCapacity: number,
): { root: QuadtreeNode; stats: BuildStats } {
  const startedAt = Date.now();
  const root = new QuadtreeNode(rootBounds);
  let itemCount = 0;

  for (const item of items) {
    insertItem(root, item, leafCapacity);
    itemCount += 1;
  }

  const stats = summarize(root);
  return {
    root,
    stats: { ...stats, itemCount, buildMs: Date.now() - startedAt },
  };
}

function insertItem(root: QuadtreeNode, item: QtItem, leafCapacity: number): void {
  let node = root;
  while (true) {
    if (node.children) {
      const next = node.children.find((c) => c.contains(item.lat, item.lng));
      if (!next) return; // off-root — silently drop (shouldn't happen with world bounds)
      node = next;
      continue;
    }
    node.items.push(item);
    if (node.items.length > leafCapacity) {
      node.subdivide();
      const toRedistribute = node.items;
      node.items = [];
      for (const held of toRedistribute) {
        const target = node.children!.find((c) => c.contains(held.lat, held.lng));
        if (target) target.items.push(held);
      }
    }
    return;
  }
}

function summarize(root: QuadtreeNode): Omit<BuildStats, 'itemCount' | 'buildMs'> {
  let leafCount = 0;
  let internalCount = 0;
  let maxDepth = 0;

  const stack: Array<{ node: QuadtreeNode; depth: number }> = [{ node: root, depth: 0 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    maxDepth = Math.max(maxDepth, depth);
    if (node.children) {
      internalCount += 1;
      for (const child of node.children) stack.push({ node: child, depth: depth + 1 });
    } else {
      leafCount += 1;
    }
  }
  return { leafCount, internalCount, maxDepth };
}
