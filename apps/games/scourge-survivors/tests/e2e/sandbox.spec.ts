import { expect, test, type Page } from '@playwright/test'

type HudSnapshot = {
  status: string
  sandbox: boolean
  weapon: string
  ammo: number
  enemiesAlive: number
  damageBoost: number
  berserk: number
  berserkFrac: number
  dualWeapon: number
  ads: boolean
  adsZoom: number
  adsZoomLevels: number
}

type AnimationSample = {
  kind: 'boss' | 'flying' | 'melee' | 'ranged'
  frame: number
  src: string
  state: string
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

  test('damage pickup activates a bounded berserk state', async ({ page }) => {
    await page.goto('/?sandbox=1')
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame)

    await page.evaluate(() => {
      type DevGame = {
        startSandbox: () => void
        ctx: {
          status: string
          damageBoostTimer: number
        }
        sys: {
          hud: { emit: () => void }
          pickups: { collectPickup: (kind: 'damage') => void }
        }
      }

      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame
      game.startSandbox()
      game.ctx.status = 'playing'
      game.sys.pickups.collectPickup('damage')
    })

    await expect.poll(() => snapshot(page).then((state) => state.berserk)).toBe(10)
    const active = await snapshot(page)
    expect(active.damageBoost).toBe(10)
    expect(active.berserkFrac).toBeGreaterThan(0.95)
    expect(active.berserkFrac).toBeLessThanOrEqual(1)
    await expect(page.locator('.scourge-berserk-meter').getByText(/BERSERK MODE/i)).toBeVisible()

    await page.evaluate(() => {
      type DevGame = {
        ctx: { damageBoostTimer: number }
        sys: {
          pickups: { collectPickup: (kind: 'damage') => void }
        }
      }

      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame
      game.ctx.damageBoostTimer = 2
      game.sys.pickups.collectPickup('damage')
    })

    await expect.poll(() => snapshot(page).then((state) => state.berserk)).toBe(10)

    await page.evaluate(() => {
      type DevGame = {
        ctx: { damageBoostTimer: number }
        sys: { hud: { emit: () => void } }
      }

      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame
      game.ctx.damageBoostTimer = 0
      game.sys.hud.emit()
    })

    await expect.poll(() => snapshot(page).then((state) => state.berserk)).toBe(0)
  })

  test('cycles generated enemy movement and attack frames', async ({ page }) => {
    await page.goto('/?sandbox=1')
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame)

    const result = await page.evaluate(async () => {
      type DevEnemy = {
        alive: boolean
        flying: boolean
        isBoss: boolean
        ranged: boolean
        spriteAnimationFrame: number
        spriteAnimationState: string
        spriteMat: {
          map?: {
            image?: {
              currentSrc?: string
              src?: string
            }
          }
        }
        attackAnimationDuration: () => number
        triggerSpriteAnimation: (animation: 'attack', duration: number) => void
      }
      type DevGame = {
        clearSandboxActors: () => void
        spawnSandboxEnemy: (kind: 'boss' | 'flying' | 'melee' | 'ranged', count?: number) => void
        startSandbox: () => void
        ctx: {
          enemies: DevEnemy[]
          status: string
        }
      }

      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame
      const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
      const sample = (): AnimationSample[] =>
        game.ctx.enemies
          .filter((enemy) => enemy.alive)
          .map((enemy) => ({
            kind: enemy.isBoss ? 'boss' : enemy.flying ? 'flying' : enemy.ranged ? 'ranged' : 'melee',
            frame: enemy.spriteAnimationFrame,
            src: enemy.spriteMat.map?.image?.currentSrc || enemy.spriteMat.map?.image?.src || '',
            state: enemy.spriteAnimationState,
          }))
          .sort((a, b) => a.kind.localeCompare(b.kind))

      game.startSandbox()
      game.ctx.status = 'playing'
      game.clearSandboxActors()
      for (const kind of ['melee', 'ranged', 'flying', 'boss'] as const) {
        game.spawnSandboxEnemy(kind, 1)
      }
      game.ctx.status = 'playing'

      await wait(240)
      const moveSamples = [sample()]
      for (let index = 0; index < 5; index += 1) {
        await wait(160)
        moveSamples.push(sample())
      }
      const moveA = moveSamples[0] ?? []
      const moveB = moveSamples[moveSamples.length - 1] ?? []
      for (const enemy of game.ctx.enemies.filter((enemy) => enemy.alive)) {
        enemy.triggerSpriteAnimation('attack', enemy.attackAnimationDuration())
      }
      await wait(320)
      const attacking = sample()

      return { moveA, moveB, moveSamples, attacking }
    })

    expect(result.moveA.map((sample) => sample.kind)).toEqual(['boss', 'flying', 'melee', 'ranged'])
    expect(result.moveB.map((sample) => sample.kind)).toEqual(['boss', 'flying', 'melee', 'ranged'])

    for (const [index, sample] of result.moveB.entries()) {
      expect(sample.state).toBe('move')
      expect(sample.src).toContain('/animations/scourge/')
    }

    for (const kind of ['boss', 'flying', 'melee', 'ranged'] as const) {
      const frames = new Set(
        result.moveSamples
          .flatMap((samples) => samples)
          .filter((sample) => sample.kind === kind)
          .map((sample) => sample.frame),
      )
      expect(frames.size).toBeGreaterThan(1)
    }

    expect(Object.fromEntries(result.attacking.map((sample) => [sample.kind, sample.src]))).toMatchObject({
      boss: expect.stringContaining('/breach-boss/barrage/'),
      flying: expect.stringContaining('/winged-host/attack/'),
      melee: expect.stringContaining('/host-grunt/slash/'),
      ranged: expect.stringContaining('/spitter-host/spit/'),
    })
    expect(result.attacking.every((sample) => sample.state === 'attack')).toBe(true)
  })
})
