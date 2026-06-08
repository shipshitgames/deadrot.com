import { describe, expect, it } from "vitest";
import { chooseDirectionalSpriteFrame, chooseMovementDirectionalSpriteFrame } from "../../src/game/directionalSprites";

describe("directional sprite frame selection", () => {
  it("keeps direct approach and retreat on front/back views", () => {
    expect(chooseDirectionalSpriteFrame(0, 1, 0, 1)).toMatchObject({
      sector: "front",
      view: "front",
      flip: 1,
    });
    expect(chooseDirectionalSpriteFrame(0, -1, 0, 1)).toMatchObject({
      sector: "back",
      view: "back",
      flip: 1,
    });
  });

  it("mirrors side frames for lateral movement without adding assets", () => {
    expect(chooseDirectionalSpriteFrame(-1, 0, 0, 1)).toMatchObject({
      sector: "right",
      view: "side",
      flip: 1,
    });
    expect(chooseDirectionalSpriteFrame(1, 0, 0, 1)).toMatchObject({
      sector: "left",
      view: "side",
      flip: -1,
    });
  });

  it("distinguishes front-side and back-side logical sectors while reusing side textures", () => {
    expect(chooseDirectionalSpriteFrame(1, 1, 0, 1)).toMatchObject({
      sector: "front-left",
      view: "side",
      flip: -1,
    });
    expect(chooseDirectionalSpriteFrame(1, -1, 0, 1)).toMatchObject({
      sector: "back-left",
      view: "side",
      flip: -1,
    });
  });

  it("keeps front/back cones narrow while diagonal sectors use mirrored sides", () => {
    const angle = (degrees: number): [number, number] => [
      Math.sin((degrees * Math.PI) / 180),
      Math.cos((degrees * Math.PI) / 180),
    ];

    expect(chooseDirectionalSpriteFrame(...angle(20), 0, 1)).toMatchObject({
      sector: "front",
      view: "front",
    });
    expect(chooseDirectionalSpriteFrame(...angle(30), 0, 1)).toMatchObject({
      sector: "front-left",
      view: "side",
    });
    expect(chooseDirectionalSpriteFrame(...angle(150), 0, 1)).toMatchObject({
      sector: "back-left",
      view: "side",
    });
    expect(chooseDirectionalSpriteFrame(...angle(165), 0, 1)).toMatchObject({
      sector: "back",
      view: "back",
    });
  });

  it("supports actor-relative mirroring for camera-relative remote player yaw", () => {
    expect(chooseDirectionalSpriteFrame(1, 0, 0, 1, { mirrorBasis: "actor" })).toMatchObject({
      sector: "right",
      view: "side",
      flip: 1,
    });
  });

  it("returns the previous frame when either direction is too small to classify", () => {
    const fallback = { sector: "back-right" as const, view: "side" as const, flip: -1 };

    expect(chooseDirectionalSpriteFrame(0, 0, 0, 1, { fallback })).toEqual(fallback);
    expect(chooseDirectionalSpriteFrame(0, 1, 0, 0, { fallback })).toEqual(fallback);
  });

  it("uses the viewer-facing vector for stationary enemy attacks", () => {
    expect(
      chooseMovementDirectionalSpriteFrame(0.01, 0, 0, 1, {
        fallback: { sector: "back-right", view: "side", flip: -1 },
        minLength: 0.05,
      }),
    ).toMatchObject({
      sector: "front",
      view: "front",
      flip: 1,
    });
  });
});
