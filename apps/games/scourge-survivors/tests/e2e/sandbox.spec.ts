import { expect, test, type Page } from '@playwright/test'

type HudSnapshot = {
  status: string
  sandbox: boolean
  weapon: string
  ammo: number
  enemiesAlive: number
  dualWeapon: number
  ads: boolean
  adsZoom: number
  adsZoomLevels: number
}

async function snapshot(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot())
}

test.describe('dev sandbox smoke', () => {
  test('loads runtime visual/audio assets and fires each gun', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (error) => consoleErrors.push(String(error)))

    await page.goto('/?sandbox=1')
    await expect(page.getByText('Scourge Labs')).toBeVisible()
    await expect(page.getByTestId('game-canvas')).toBeVisible()
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame)

    expect(await snapshot(page)).toMatchObject({
      status: 'pointerlock-needed',
      sandbox: true,
    })

    const brokenImages = await page.$$eval('img', (images) =>
      images
        .filter((img) => !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0)
        .map((img) => img.currentSrc || img.src),
    )
    expect(brokenImages).toEqual([])

    await page.getByRole('button', { name: /runtime assets/i }).click()

    const assetLabels = await page.locator('figcaption').evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''))
    expect(assetLabels).toEqual(expect.arrayContaining([
      'Pistol',
      'SMG',
      'Shotgun',
      'Cannon',
      'Sniper',
      'Melee front',
      'Melee side',
      'Melee back',
      'Ranged front',
      'Ranged side',
      'Ranged back',
      'Flying front',
      'Flying side',
      'Flying back',
      'Boss front',
      'Boss side',
      'Boss back',
      'Ranger front',
      'Ranger side',
      'Ranger back',
      'Bulwark front',
      'Bulwark side',
      'Bulwark back',
      'Vector front',
      'Vector side',
      'Vector back',
      'Patch front',
      'Patch side',
      'Patch back',
      'Health pickup',
      'Ammo pickup',
      'Damage pickup',
      'Dual pickup',
      'XP ichor',
    ]))

    await page.getByRole('button', { name: /^audio$/i }).click()
    await expect.poll(
      () => page.$$eval('audio', (nodes) => nodes.map((node) => node.readyState)),
      { timeout: 15_000 },
    ).toEqual([4, 4, 4, 4, 4, 4, 4])

    const weapons = page.locator('section').filter({ hasText: 'Weapons' })
    for (const weapon of ['Pistol', 'SMG', 'Shotgun', 'Cannon', 'Sniper']) {
      await weapons.getByRole('button', { name: new RegExp(`^${weapon}$`, 'i') }).click()
      await expect.poll(() => snapshot(page).then((state) => state.weapon)).toBe(weapon)

      const before = await snapshot(page)
      await weapons.getByRole('button', { name: /fire once/i }).click()
      await expect.poll(() => snapshot(page).then((state) => state.ammo)).toBe(before.ammo - 1)
    }

    await page.getByRole('button', { name: /pickups/i }).click()

    const pickups = page.locator('section').filter({ hasText: 'Pickups' })
    await expect(pickups.getByRole('button', { name: /^dual$/i })).toBeVisible()
    await pickups.getByRole('button', { name: /^dual$/i }).click()

    await page.getByRole('button', { name: /foes \+ reactions/i }).click()

    const foes = page.locator('section').filter({ hasText: 'Foes + Reactions' })
    await expect(foes.getByRole('button', { name: /spawn flying/i })).toBeVisible()
    await foes.getByRole('button', { name: /spawn flying/i }).click()
    await expect.poll(() => snapshot(page).then((state) => state.enemiesAlive)).toBeGreaterThan(0)

    expect(consoleErrors).toEqual([])
  })
})
