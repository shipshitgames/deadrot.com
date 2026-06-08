import { expect, test, type Page } from "@playwright/test";

type SurvivorClassId = "ranger" | "heavy" | "scout" | "medic";
type WeaponId = "pistol" | "smg" | "shotgun" | "cannon" | "sniper";

type HudSnapshot = {
  survivors: boolean;
  survivorClassId: string;
  weapon: string;
  ammo: number;
  reserve: number;
  weapons: { id: string; name: string; active: boolean }[];
};

type DevGame = {
  startSurvivors: (classId: SurvivorClassId) => void;
  restart: () => void;
  sys: {
    hud: { emit: () => void };
    weapon: { unlockWeapon: (id: WeaponId) => void };
  };
};

async function snapshot(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot());
}

async function startSurvivors(page: Page, classId: SurvivorClassId) {
  await page.evaluate((id) => {
    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    game.startSurvivors(id);
    game.sys.hud.emit();
  }, classId);
}

test.describe("survivor starting weapons", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLElement.prototype, "requestPointerLock", {
        configurable: true,
        value: function requestPointerLock() {},
      });
      Object.defineProperty(document, "exitPointerLock", {
        configurable: true,
        value: function exitPointerLock() {},
      });
    });
  });

  test("arms each selected operator with its class weapon", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    const cases: Array<[SurvivorClassId, string, number, WeaponId]> = [
      ["ranger", "Pistol", 15, "pistol"],
      ["heavy", "Shotgun", 8, "shotgun"],
      ["scout", "SMG", 45, "smg"],
      ["medic", "Sniper", 5, "sniper"],
    ];

    for (const [classId, weaponName, ammo, weaponId] of cases) {
      await startSurvivors(page, classId);

      await expect
        .poll(() => snapshot(page))
        .toMatchObject({
          survivors: true,
          survivorClassId: classId,
          weapon: weaponName,
          ammo,
          reserve: 0,
          weapons: [{ id: weaponId, name: weaponName, active: true }],
        });
    }
  });

  test("restart returns to the selected class weapon", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    await startSurvivors(page, "scout");
    await page.evaluate(() => {
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.sys.weapon.unlockWeapon("cannon");
      game.sys.hud.emit();
    });
    await expect.poll(() => snapshot(page).then((state) => state.weapon)).toBe("Cannon");

    await page.evaluate(() => {
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.restart();
      game.sys.hud.emit();
    });

    await expect
      .poll(() => snapshot(page))
      .toMatchObject({
        survivors: true,
        survivorClassId: "scout",
        weapon: "SMG",
        ammo: 45,
        reserve: 0,
        weapons: [{ id: "smg", name: "SMG", active: true }],
      });
  });
});
