import { expect, test } from "@playwright/test";
import { SURVIVOR_CLASS_IDS, SURVIVOR_CLASSES } from "../../src/game/data/survivors";
import { WEAPON_IDENTITIES } from "../../src/game/data/weaponIdentity";

test.describe("survivor character selection (#67)", () => {
  test("shows every starting weapon and signature bonus", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /Play a Run/i }).click();

    for (const id of SURVIVOR_CLASS_IDS) {
      const survivorClass = SURVIVOR_CLASSES[id];
      const weapon = WEAPON_IDENTITIES[survivorClass.startingWeapon];
      const card = page.getByTestId(`survivor-class-card-${id}`);

      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("data-starting-weapon", survivorClass.startingWeapon);
      await expect(card).toContainText(survivorClass.name);
      await expect(card).toContainText(survivorClass.role);
      await expect(card).toContainText(weapon.displayName);
      await expect(card).toContainText(survivorClass.desc);
    }

    const vectorCard = page.getByTestId("survivor-class-card-scout");
    await vectorCard.click();
    await expect(vectorCard).toHaveAttribute("aria-pressed", "true");

    const selected = page.getByTestId("selected-survivor-class");
    await expect(selected).toContainText(SURVIVOR_CLASSES.scout.name);
    await expect(selected).toContainText(WEAPON_IDENTITIES[SURVIVOR_CLASSES.scout.startingWeapon].displayName);
    await expect(selected).toContainText(SURVIVOR_CLASSES.scout.desc);
  });
});
