import {
  type ActionMap,
  actionFor,
  applyMoveKey,
  clearMoveIntent,
  DEFAULT_MOVE_KEYS,
  DEFAULT_MOVEMENT_CONFIG,
  isJumpKey,
  type MoveIntent,
  makeMoveIntent,
} from "@shipshitgames/engine";
import { describe, expect, it } from "vitest";

describe("engine input bindings (#88)", () => {
  describe("makeMoveIntent", () => {
    it("starts every planar direction false and returns a fresh object each call", () => {
      const a = makeMoveIntent();
      const b = makeMoveIntent();

      expect(a).toEqual({ forward: false, back: false, left: false, right: false });
      // distinct instances so two controllers never share mutable intent state
      expect(a).not.toBe(b);
    });
  });

  describe("DEFAULT_MOVE_KEYS", () => {
    it("maps both WASD and arrow keys to the matching MoveIntent fields", () => {
      expect(DEFAULT_MOVE_KEYS.KeyW).toBe("forward");
      expect(DEFAULT_MOVE_KEYS.ArrowUp).toBe("forward");
      expect(DEFAULT_MOVE_KEYS.KeyS).toBe("back");
      expect(DEFAULT_MOVE_KEYS.ArrowDown).toBe("back");
      expect(DEFAULT_MOVE_KEYS.KeyA).toBe("left");
      expect(DEFAULT_MOVE_KEYS.ArrowLeft).toBe("left");
      expect(DEFAULT_MOVE_KEYS.KeyD).toBe("right");
      expect(DEFAULT_MOVE_KEYS.ArrowRight).toBe("right");
    });

    it("does not bind keys outside the movement vocabulary", () => {
      expect(DEFAULT_MOVE_KEYS.Space).toBeUndefined();
      expect(DEFAULT_MOVE_KEYS.KeyQ).toBeUndefined();
    });
  });

  describe("applyMoveKey with the default mapping", () => {
    it("sets the correct field for each WASD key on press and clears it on release", () => {
      const move = makeMoveIntent();

      expect(applyMoveKey(move, "KeyW", true)).toBe(true);
      expect(move.forward).toBe(true);

      expect(applyMoveKey(move, "KeyS", true)).toBe(true);
      expect(move.back).toBe(true);

      expect(applyMoveKey(move, "KeyA", true)).toBe(true);
      expect(move.left).toBe(true);

      expect(applyMoveKey(move, "KeyD", true)).toBe(true);
      expect(move.right).toBe(true);

      // every direction now active
      expect(move).toEqual({ forward: true, back: true, left: true, right: true });

      // release maps to false on the same field, returns true (still a move key)
      expect(applyMoveKey(move, "KeyW", false)).toBe(true);
      expect(move.forward).toBe(false);
      expect(move).toEqual({ forward: false, back: true, left: true, right: true });
    });

    it("routes arrow keys to the same intent fields as WASD", () => {
      const move = makeMoveIntent();

      expect(applyMoveKey(move, "ArrowUp", true)).toBe(true);
      expect(move.forward).toBe(true);

      expect(applyMoveKey(move, "ArrowRight", true)).toBe(true);
      expect(move.right).toBe(true);
    });

    it("returns false and leaves intent untouched for unbound keys", () => {
      const move = makeMoveIntent();

      expect(applyMoveKey(move, "KeyQ", true)).toBe(false);
      expect(applyMoveKey(move, "Space", true)).toBe(false);
      expect(move).toEqual({ forward: false, back: false, left: false, right: false });
    });
  });

  describe("applyMoveKey with a custom MovementConfig / MovementKeyMap", () => {
    it("honours an override mapping and ignores the default keys", () => {
      const move = makeMoveIntent();
      const config = { moveKeys: { KeyQ: "left", KeyE: "right" } as const };

      // custom key now counts as a move key
      expect(applyMoveKey(move, "KeyQ", true, config)).toBe(true);
      expect(move.left).toBe(true);

      expect(applyMoveKey(move, "KeyE", true, config)).toBe(true);
      expect(move.right).toBe(true);

      // a default WASD key is NOT in the override map, so it is rejected
      expect(applyMoveKey(move, "KeyW", true, config)).toBe(false);
      expect(move.forward).toBe(false);
    });
  });

  describe("isJumpKey", () => {
    it("treats Space as the jump key by default and rejects others", () => {
      expect(isJumpKey("Space")).toBe(true);
      expect(isJumpKey("KeyW")).toBe(false);
      expect(isJumpKey("Enter")).toBe(false);
    });

    it("respects a custom jumpCode override", () => {
      const config = { jumpCode: "Enter" };

      expect(isJumpKey("Enter", config)).toBe(true);
      // Space is no longer the jump key once overridden
      expect(isJumpKey("Space", config)).toBe(false);
    });
  });

  describe("DEFAULT_MOVEMENT_CONFIG", () => {
    it("bundles the default move keys with a Space jump and is frozen", () => {
      expect(DEFAULT_MOVEMENT_CONFIG.jumpCode).toBe("Space");
      expect(DEFAULT_MOVEMENT_CONFIG.moveKeys).toBe(DEFAULT_MOVE_KEYS);
      expect(Object.isFrozen(DEFAULT_MOVEMENT_CONFIG)).toBe(true);
    });
  });

  describe("actionFor", () => {
    it("returns the verb a physical key is bound to, or undefined when unbound", () => {
      const map: ActionMap = {
        KeyR: "reload",
        KeyF: "melee",
        Digit1: "weapon1",
      };

      expect(actionFor(map, "KeyR")).toBe("reload");
      expect(actionFor(map, "KeyF")).toBe("melee");
      expect(actionFor(map, "Digit1")).toBe("weapon1");
      expect(actionFor(map, "KeyZ")).toBeUndefined();
    });

    it("preserves the literal action type through the generic lookup", () => {
      const map = { KeyG: "grenade", KeyH: "heal" } as const;
      const action: "grenade" | "heal" | undefined = actionFor(map, "KeyG");

      expect(action).toBe("grenade");
    });
  });

  describe("clearMoveIntent", () => {
    it("resets a fully-active intent back to all-false", () => {
      const move: MoveIntent = { forward: true, back: true, left: true, right: true };

      clearMoveIntent(move);

      expect(move).toEqual({ forward: false, back: false, left: false, right: false });
    });

    it("mutates the passed object in place rather than returning a new one", () => {
      const move = makeMoveIntent();
      move.forward = true;
      move.right = true;

      const result = clearMoveIntent(move) as unknown;

      expect(result).toBeUndefined();
      expect(move.forward).toBe(false);
      expect(move.right).toBe(false);
    });
  });
});
