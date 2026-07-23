export interface SpatialTarget {
  mesh: { position: { x: number; y: number } };
  radius: number;
  dead: boolean;
}

/**
 * Fixed-size uniform grid for the bounded Starblight arena. Buckets and query
 * output are reused so rebuilding and querying do not allocate in the hot path.
 */
export class SpatialGrid<T extends SpatialTarget> {
  private readonly columns: number;
  private readonly rows: number;
  private readonly buckets: T[][];
  private readonly order = new WeakMap<T, number>();
  private maxTargetRadius = 0;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly cellSize: number,
  ) {
    if (width <= 0 || height <= 0 || cellSize <= 0) {
      throw new Error("SpatialGrid dimensions and cell size must be positive");
    }
    this.columns = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.buckets = Array.from({ length: this.columns * this.rows }, () => []);
  }

  get maxRadius(): number {
    return this.maxTargetRadius;
  }

  rebuild(targets: readonly T[]): void {
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i].length = 0;
    this.maxTargetRadius = 0;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (target.dead) continue;
      this.order.set(target, i);
      this.maxTargetRadius = Math.max(this.maxTargetRadius, target.radius);
      this.buckets[this.indexFor(target.mesh.position.x, target.mesh.position.y)].push(target);
    }
  }

  /**
   * Writes live targets intersecting the circle into `out` in source-array
   * order. Set `includeTargetRadius` false for center-only effects such as nova.
   */
  queryCircle(x: number, y: number, radius: number, out: T[], includeTargetRadius = true): T[] {
    out.length = 0;
    const safeRadius = Math.max(0, radius);
    const searchRadius = safeRadius + (includeTargetRadius ? this.maxTargetRadius : 0);
    const minColumn = this.columnFor(x - searchRadius);
    const maxColumn = this.columnFor(x + searchRadius);
    const minRow = this.rowFor(y - searchRadius);
    const maxRow = this.rowFor(y + searchRadius);

    for (let row = minRow; row <= maxRow; row++) {
      const offset = row * this.columns;
      for (let column = minColumn; column <= maxColumn; column++) {
        const bucket = this.buckets[offset + column];
        for (let i = 0; i < bucket.length; i++) {
          const target = bucket[i];
          if (target.dead) continue;
          const dx = target.mesh.position.x - x;
          const dy = target.mesh.position.y - y;
          const hitRadius = safeRadius + (includeTargetRadius ? target.radius : 0);
          if (dx * dx + dy * dy <= hitRadius * hitRadius) out.push(target);
        }
      }
    }

    this.restoreSourceOrder(out);
    return out;
  }

  nearest(x: number, y: number, maxRange = Infinity, exclude?: readonly T[]): T | null {
    const finiteRange = Number.isFinite(maxRange);
    const safeRange = finiteRange ? Math.max(0, maxRange) : Infinity;
    const startColumn = this.columnFor(x);
    const startRow = this.rowFor(y);
    const maxRing = Math.max(this.columns, this.rows);
    let best: T | null = null;
    let bestDistance = safeRange * safeRange;
    let bestOrder = Infinity;

    for (let ring = 0; ring < maxRing; ring++) {
      const minColumn = startColumn - ring;
      const maxColumn = startColumn + ring;
      const minRow = startRow - ring;
      const maxRow = startRow + ring;

      for (let row = minRow; row <= maxRow; row++) {
        for (let column = minColumn; column <= maxColumn; column++) {
          if (row !== minRow && row !== maxRow && column !== minColumn && column !== maxColumn) continue;
          if (column < 0 || column >= this.columns || row < 0 || row >= this.rows) continue;
          const bucket = this.buckets[row * this.columns + column];
          for (let i = 0; i < bucket.length; i++) {
            const target = bucket[i];
            if (target.dead || isExcluded(target, exclude)) continue;
            const dx = target.mesh.position.x - x;
            const dy = target.mesh.position.y - y;
            const distance = dx * dx + dy * dy;
            const targetOrder = this.order.get(target) ?? Infinity;
            if (distance < bestDistance || (distance === bestDistance && targetOrder < bestOrder)) {
              best = target;
              bestDistance = distance;
              bestOrder = targetOrder;
            }
          }
        }
      }

      const outsideDistance = this.distanceToUnvisitedCells(x, y, minColumn, maxColumn, minRow, maxRow);
      if (bestDistance < outsideDistance * outsideDistance || safeRange <= outsideDistance) break;
    }

    return best;
  }

  private restoreSourceOrder(out: T[]): void {
    // Candidate sets are small. Insertion sort preserves legacy enemy-array
    // collision priority without allocating a comparator closure per query.
    for (let i = 1; i < out.length; i++) {
      const value = out[i];
      const valueOrder = this.order.get(value) ?? Infinity;
      let j = i - 1;
      while (j >= 0 && (this.order.get(out[j]) ?? Infinity) > valueOrder) {
        out[j + 1] = out[j];
        j--;
      }
      out[j + 1] = value;
    }
  }

  private indexFor(x: number, y: number): number {
    return this.rowFor(y) * this.columns + this.columnFor(x);
  }

  private columnFor(x: number): number {
    return clampIndex(Math.floor((x + this.width / 2) / this.cellSize), this.columns);
  }

  private rowFor(y: number): number {
    return clampIndex(Math.floor((y + this.height / 2) / this.cellSize), this.rows);
  }

  private distanceToUnvisitedCells(
    x: number,
    y: number,
    minColumn: number,
    maxColumn: number,
    minRow: number,
    maxRow: number,
  ): number {
    const left = minColumn > 0 ? x - (-this.width / 2 + minColumn * this.cellSize) : Infinity;
    const right = maxColumn < this.columns - 1 ? -this.width / 2 + (maxColumn + 1) * this.cellSize - x : Infinity;
    const bottom = minRow > 0 ? y - (-this.height / 2 + minRow * this.cellSize) : Infinity;
    const top = maxRow < this.rows - 1 ? -this.height / 2 + (maxRow + 1) * this.cellSize - y : Infinity;
    return Math.max(0, Math.min(left, right, bottom, top));
  }
}

function clampIndex(index: number, count: number): number {
  return index < 0 ? 0 : index >= count ? count - 1 : index;
}

function isExcluded<T>(target: T, excluded?: readonly T[]): boolean {
  if (!excluded) return false;
  for (let i = 0; i < excluded.length; i++) {
    if (excluded[i] === target) return true;
  }
  return false;
}
