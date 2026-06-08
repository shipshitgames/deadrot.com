import * as THREE from "three";
import { CONSTANTS } from "./constants";

/**
 * Board geometry helpers. The grid is centered on the origin and lies on the
 * XZ plane (y = 0). Columns map to X, rows map to Z.
 */

const { cols, rows, cell, path } = CONSTANTS.board;

const worldWidth = cols * cell;
const worldDepth = rows * cell;

/** Center world position of grid cell (col,row). */
export function cellToWorld(col: number, row: number): THREE.Vector3 {
  const x = (col + 0.5) * cell - worldWidth / 2;
  const z = (row + 0.5) * cell - worldDepth / 2;
  return new THREE.Vector3(x, 0, z);
}

/** Convert a world XZ position back to integer grid coords (may be off-board). */
export function worldToCell(x: number, z: number): { col: number; row: number } {
  const col = Math.floor((x + worldWidth / 2) / cell);
  const row = Math.floor((z + worldDepth / 2) / cell);
  return { col, row };
}

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < cols && row >= 0 && row < rows;
}

/** Precomputed set of cells the lane occupies (towers can't build on these). */
export const pathCells: Set<string> = buildPathCells();

function key(col: number, row: number): string {
  return `${col},${row}`;
}

export function isPathCell(col: number, row: number): boolean {
  return pathCells.has(key(col, row));
}

function buildPathCells(): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) {
    const [c0, r0] = path[i];
    const [c1, r1] = path[i + 1];
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0;
    let r = r0;
    set.add(key(c, r));
    while (c !== c1 || r !== r1) {
      c += dc;
      r += dr;
      set.add(key(c, r));
    }
  }
  return set;
}

/** World-space waypoints of the lane, in order (spawn -> base). */
export const pathPoints: THREE.Vector3[] = path.map(([c, r]) => cellToWorld(c, r));

export const spawnPoint = pathPoints[0];
export const basePoint = pathPoints[pathPoints.length - 1];

const firstLaneDirection = spawnPoint.clone().sub(pathPoints[1]).normalize();

/** The visible breach door outside the board; mobs emerge here before entering the lane. */
export const breachDoorPoint = spawnPoint.clone().addScaledVector(firstLaneDirection, cell * 5);

/** Full mob path, including the long approach from the door into the board. */
export const mobPathPoints: THREE.Vector3[] = [breachDoorPoint, ...pathPoints];

export const boardSize = { worldWidth, worldDepth };

export const boardBounds = {
  minX: -worldWidth / 2,
  maxX: worldWidth / 2,
  minZ: -worldDepth / 2,
  maxZ: worldDepth / 2,
};

export const playBounds = {
  minX: Math.min(boardBounds.minX, breachDoorPoint.x) - cell * 0.8,
  maxX: boardBounds.maxX + cell * 0.8,
  minZ: boardBounds.minZ - cell * 0.8,
  maxZ: boardBounds.maxZ + cell * 0.8,
};
