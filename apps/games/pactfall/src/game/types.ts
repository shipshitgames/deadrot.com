import * as THREE from 'three';
import type { Team } from './constants';

export type EntityKind = 'champion' | 'minion' | 'scourge' | 'base';

// A flat, struct-ish entity. Systems read/write these fields directly; the
// mesh is the visual twin kept in sync each frame.
export interface Entity {
  id: number;
  kind: EntityKind;
  team: Team | 'neutral';
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  // combat
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  cooldown: number; // current time left until next attack
}

export type Phase = 'playing' | 'won' | 'lost';
