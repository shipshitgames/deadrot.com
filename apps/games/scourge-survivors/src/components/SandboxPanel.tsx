import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { HUDState } from '../game/types'
import { MAP_PICKER } from '../game/data/maps'
import { STARTING_WEAPON, WEAPON_ORDER, WEAPONS, type PickupKind, type WeaponId } from '../game/constants'
import type { SandboxEnemyKind } from '../game/Game'
import { RUNTIME_AUDIO_ASSET_URLS } from '../game/spriteAssets'

import bossBack from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/breach-boss/back.webp'
import bossFront from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/breach-boss/front.webp'
import bossSide from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/breach-boss/side.webp'
import enemyMeleeBack from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/host-grunt/back.webp'
import enemyMeleeFront from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/host-grunt/front.webp'
import enemyMeleeSide from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/host-grunt/side.webp'
import enemyFlyingBack from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/winged-host/back.webp'
import enemyFlyingFront from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/winged-host/front.webp'
import enemyFlyingSide from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/winged-host/side.webp'
import enemyRangedBack from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/spitter-host/back.webp'
import enemyRangedFront from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/spitter-host/front.webp'
import enemyRangedSide from '@shipshitgames/assets/games/scourge-survivors/enemies/scourge/spitter-host/side.webp'
import playerHeavyBack from '@shipshitgames/assets/games/scourge-survivors/players/pyre/bulwark/back.webp'
import playerHeavyFront from '@shipshitgames/assets/games/scourge-survivors/players/pyre/bulwark/front.webp'
import playerHeavySide from '@shipshitgames/assets/games/scourge-survivors/players/pyre/bulwark/side.webp'
import playerMedicBack from '@shipshitgames/assets/games/scourge-survivors/players/pyre/patch/back.webp'
import playerMedicFront from '@shipshitgames/assets/games/scourge-survivors/players/pyre/patch/front.webp'
import playerMedicSide from '@shipshitgames/assets/games/scourge-survivors/players/pyre/patch/side.webp'
import playerRangerBack from '@shipshitgames/assets/games/scourge-survivors/players/pyre/ranger/back.webp'
import playerRangerFront from '@shipshitgames/assets/games/scourge-survivors/players/pyre/ranger/front.webp'
import playerRangerSide from '@shipshitgames/assets/games/scourge-survivors/players/pyre/ranger/side.webp'
import playerScoutBack from '@shipshitgames/assets/games/scourge-survivors/players/pyre/vector/back.webp'
import playerScoutFront from '@shipshitgames/assets/games/scourge-survivors/players/pyre/vector/front.webp'
import playerScoutSide from '@shipshitgames/assets/games/scourge-survivors/players/pyre/vector/side.webp'
import projectileBoss from '@shipshitgames/assets/games/scourge-survivors/projectiles/scourge/boss-barrage.webp'
import projectileEnemy from '@shipshitgames/assets/games/scourge-survivors/projectiles/scourge/enemy-spit.webp'
import pickupAmmo from '@shipshitgames/assets/games/scourge-survivors/pickups/ammo/bone-cache.webp'
import pickupDamage from '@shipshitgames/assets/games/scourge-survivors/pickups/bonus/damage-boost.webp'
import pickupDual from '@shipshitgames/assets/games/scourge-survivors/pickups/bonus/dual-wield.webp'
import pickupHealth from '@shipshitgames/assets/games/scourge-survivors/pickups/health/blood-vial.webp'
import pickupXpBlood from '@shipshitgames/assets/games/scourge-survivors/pickups/xp/scourge-ichor.webp'
import weaponCannon from '@shipshitgames/assets/games/scourge-survivors/weapons/pyre/cannon.webp'
import weaponPistol from '@shipshitgames/assets/games/scourge-survivors/weapons/pyre/pistol.webp'
import weaponShotgun from '@shipshitgames/assets/games/scourge-survivors/weapons/pyre/shotgun.webp'
import weaponSmg from '@shipshitgames/assets/games/scourge-survivors/weapons/pyre/smg.webp'
import weaponSniper from '@shipshitgames/assets/games/scourge-survivors/weapons/pyre/sniper.webp'
import arenaBlock from '@shipshitgames/assets/games/scourge-survivors/textures/arenas/generic/block.webp'
import arenaColumn from '@shipshitgames/assets/games/scourge-survivors/textures/arenas/generic/column.webp'
import arenaFloor from '@shipshitgames/assets/games/scourge-survivors/textures/arenas/generic/floor.webp'
import arenaWall from '@shipshitgames/assets/games/scourge-survivors/textures/arenas/generic/wall.webp'
import menuCardBastion from '@shipshitgames/assets/games/scourge-survivors/ui/cards/codex/bastion.jpg'
import menuCardBastionPng from '@shipshitgames/assets/games/scourge-survivors/ui/cards/codex/bastion.png'
import menuCardBreach from '@shipshitgames/assets/games/scourge-survivors/ui/cards/codex/breach.jpg'
import menuCardBreachPng from '@shipshitgames/assets/games/scourge-survivors/ui/cards/codex/breach.png'
import menuCardFleshworks from '@shipshitgames/assets/games/scourge-survivors/ui/cards/codex/fleshworks.jpg'
import menuCardFleshworksPng from '@shipshitgames/assets/games/scourge-survivors/ui/cards/codex/fleshworks.png'
import menuHeroJpg from '@shipshitgames/assets/games/scourge-survivors/ui/menu/scourge-hero.jpg'
import menuHeroPng from '@shipshitgames/assets/games/scourge-survivors/ui/menu/scourge-hero.png'

interface Props {
  state: HUDState
  onStart: (mapId?: string) => void
  onExit: () => void
  onLock: () => void
  onWeapon: (id: WeaponId) => void
  onFire: () => void
  onRefill: () => void
  onSpawnEnemy: (kind: SandboxEnemyKind, count?: number) => void
  onDamage: (amount: number, headshot?: boolean, all?: boolean) => void
  onSpawnPickup: (kind: PickupKind) => void
  onClear: () => void
}

type AssetKind = 'sprite' | 'texture' | 'ui'
type VisualAsset = { id: string; label: string; src: string; kind: AssetKind }
type AudioAsset = { id: string; label: string; src: string; kind: 'music' | 'sfx' }

const WEAPON_IMAGES: Record<WeaponId, string> = {
  pistol: weaponPistol,
  smg: weaponSmg,
  shotgun: weaponShotgun,
  cannon: weaponCannon,
  sniper: weaponSniper,
}

const VISUAL_ASSETS: VisualAsset[] = [
  { id: 'weapon-pistol', label: 'Pistol', src: weaponPistol, kind: 'sprite' },
  { id: 'weapon-smg', label: 'SMG', src: weaponSmg, kind: 'sprite' },
  { id: 'weapon-shotgun', label: 'Shotgun', src: weaponShotgun, kind: 'sprite' },
  { id: 'weapon-cannon', label: 'Cannon', src: weaponCannon, kind: 'sprite' },
  { id: 'weapon-sniper', label: 'Sniper', src: weaponSniper, kind: 'sprite' },
  { id: 'enemy-melee-front', label: 'Melee front', src: enemyMeleeFront, kind: 'sprite' },
  { id: 'enemy-melee-side', label: 'Melee side', src: enemyMeleeSide, kind: 'sprite' },
  { id: 'enemy-melee-back', label: 'Melee back', src: enemyMeleeBack, kind: 'sprite' },
  { id: 'enemy-ranged-front', label: 'Ranged front', src: enemyRangedFront, kind: 'sprite' },
  { id: 'enemy-ranged-side', label: 'Ranged side', src: enemyRangedSide, kind: 'sprite' },
  { id: 'enemy-ranged-back', label: 'Ranged back', src: enemyRangedBack, kind: 'sprite' },
  { id: 'enemy-flying-front', label: 'Flying front', src: enemyFlyingFront, kind: 'sprite' },
  { id: 'enemy-flying-side', label: 'Flying side', src: enemyFlyingSide, kind: 'sprite' },
  { id: 'enemy-flying-back', label: 'Flying back', src: enemyFlyingBack, kind: 'sprite' },
  { id: 'boss-front', label: 'Boss front', src: bossFront, kind: 'sprite' },
  { id: 'boss-side', label: 'Boss side', src: bossSide, kind: 'sprite' },
  { id: 'boss-back', label: 'Boss back', src: bossBack, kind: 'sprite' },
  { id: 'player-ranger-front', label: 'Ranger front', src: playerRangerFront, kind: 'sprite' },
  { id: 'player-ranger-side', label: 'Ranger side', src: playerRangerSide, kind: 'sprite' },
  { id: 'player-ranger-back', label: 'Ranger back', src: playerRangerBack, kind: 'sprite' },
  { id: 'player-heavy-front', label: 'Bulwark front', src: playerHeavyFront, kind: 'sprite' },
  { id: 'player-heavy-side', label: 'Bulwark side', src: playerHeavySide, kind: 'sprite' },
  { id: 'player-heavy-back', label: 'Bulwark back', src: playerHeavyBack, kind: 'sprite' },
  { id: 'player-scout-front', label: 'Vector front', src: playerScoutFront, kind: 'sprite' },
  { id: 'player-scout-side', label: 'Vector side', src: playerScoutSide, kind: 'sprite' },
  { id: 'player-scout-back', label: 'Vector back', src: playerScoutBack, kind: 'sprite' },
  { id: 'player-medic-front', label: 'Patch front', src: playerMedicFront, kind: 'sprite' },
  { id: 'player-medic-side', label: 'Patch side', src: playerMedicSide, kind: 'sprite' },
  { id: 'player-medic-back', label: 'Patch back', src: playerMedicBack, kind: 'sprite' },
  { id: 'projectile-enemy', label: 'Enemy shot', src: projectileEnemy, kind: 'sprite' },
  { id: 'projectile-boss', label: 'Boss shot', src: projectileBoss, kind: 'sprite' },
  { id: 'pickup-health', label: 'Health pickup', src: pickupHealth, kind: 'sprite' },
  { id: 'pickup-ammo', label: 'Ammo pickup', src: pickupAmmo, kind: 'sprite' },
  { id: 'pickup-damage', label: 'Damage pickup', src: pickupDamage, kind: 'sprite' },
  { id: 'pickup-dual', label: 'Dual pickup', src: pickupDual, kind: 'sprite' },
  { id: 'pickup-xp-blood', label: 'XP ichor', src: pickupXpBlood, kind: 'sprite' },
  { id: 'arena-floor', label: 'Arena floor', src: arenaFloor, kind: 'texture' },
  { id: 'arena-wall', label: 'Arena wall', src: arenaWall, kind: 'texture' },
  { id: 'arena-column', label: 'Arena column', src: arenaColumn, kind: 'texture' },
  { id: 'arena-block', label: 'Arena block', src: arenaBlock, kind: 'texture' },
  { id: 'ui-hero-jpg', label: 'Menu hero jpg', src: menuHeroJpg, kind: 'ui' },
  { id: 'ui-hero-png', label: 'Menu hero png', src: menuHeroPng, kind: 'ui' },
  { id: 'ui-breach-jpg', label: 'Breach card jpg', src: menuCardBreach, kind: 'ui' },
  { id: 'ui-breach-png', label: 'Breach card png', src: menuCardBreachPng, kind: 'ui' },
  { id: 'ui-bastion-jpg', label: 'Bastion card jpg', src: menuCardBastion, kind: 'ui' },
  { id: 'ui-bastion-png', label: 'Bastion card png', src: menuCardBastionPng, kind: 'ui' },
  { id: 'ui-fleshworks-jpg', label: 'Fleshworks card jpg', src: menuCardFleshworks, kind: 'ui' },
  { id: 'ui-fleshworks-png', label: 'Fleshworks card png', src: menuCardFleshworksPng, kind: 'ui' },
]

const AUDIO_ASSETS: AudioAsset[] = [
  { id: 'music-ash-reactor', label: 'Ash Reactor', src: RUNTIME_AUDIO_ASSET_URLS['music-ash-reactor'], kind: 'music' },
  { id: 'music-blood-circuit', label: 'Blood Circuit Ascension', src: RUNTIME_AUDIO_ASSET_URLS['music-blood-circuit-ascension'], kind: 'music' },
  { id: 'sfx-pistol-pyre', label: 'Pistol SFX', src: RUNTIME_AUDIO_ASSET_URLS['sfx-pistol-pyre'], kind: 'sfx' },
  { id: 'sfx-sniper', label: 'Sniper SFX', src: RUNTIME_AUDIO_ASSET_URLS['sfx-sniper'], kind: 'sfx' },
  { id: 'sfx-smg-pyre', label: 'Pyre SMG SFX', src: RUNTIME_AUDIO_ASSET_URLS['sfx-smg-pyre'], kind: 'sfx' },
  { id: 'sfx-shotgun', label: 'Shotgun SFX', src: RUNTIME_AUDIO_ASSET_URLS['sfx-shotgun'], kind: 'sfx' },
  { id: 'sfx-cannon', label: 'Cannon SFX', src: RUNTIME_AUDIO_ASSET_URLS['sfx-cannon'], kind: 'sfx' },
]

const PICKUP_KINDS: PickupKind[] = ['health', 'ammo', 'damage', 'dual', ...WEAPON_ORDER]
const ASSET_FILTERS: Array<'all' | AssetKind | 'audio'> = ['all', 'sprite', 'texture', 'ui', 'audio']

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function LabButton({
  children,
  onClick,
  active = false,
  danger = false,
  className = '',
}: {
  children: ReactNode
  onClick: () => void
  active?: boolean
  danger?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      className={cx(
        'pointer-events-auto min-h-[34px] rounded-[7px] border px-3 py-2 text-[12px] font-extrabold tracking-[0.03em] transition-[background,border-color,transform] hover:-translate-y-px active:translate-y-0',
        active
          ? 'border-[#ff6a00] bg-[#ff6a00] text-[#100806]'
          : danger
            ? 'border-[#c1121f]/70 bg-[#c1121f]/20 text-[#ffd7d7] hover:bg-[#c1121f]/32'
            : 'border-white/15 bg-black/45 text-[#e9e3d6] hover:border-[#ff6a00]/55 hover:bg-[#ff6a00]/14',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = `sandbox-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <section className="border-t border-white/10 pt-3">
      <button
        type="button"
        className="pointer-events-auto mb-2 flex min-h-[32px] w-full items-center justify-between gap-3 rounded-[6px] border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-left text-[11px] font-black uppercase tracking-[0.16em] text-[#ffb26b] transition-[background,border-color] hover:border-[#ff6a00]/50 hover:bg-[#ff6a00]/10"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-white/15 bg-black/45 text-[13px] leading-none text-[#e9e3d6]" aria-hidden>
          {open ? '-' : '+'}
        </span>
      </button>
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </section>
  )
}

function AssetGrid({ assets }: { assets: VisualAsset[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {assets.map((asset) => (
        <figure key={asset.id} className="m-0 overflow-hidden rounded-[7px] border border-white/10 bg-black/35">
          <div className="flex h-[74px] items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,106,0,0.12),transparent_65%)] p-1">
            <img
              src={asset.src}
              alt=""
              className="max-h-full max-w-full object-contain"
              style={{ imageRendering: asset.kind === 'sprite' ? 'pixelated' : 'auto' }}
              draggable={false}
            />
          </div>
          <figcaption className="truncate border-t border-white/10 px-2 py-1 text-[10px] text-white/70">{asset.label}</figcaption>
        </figure>
      ))}
    </div>
  )
}

function AudioList({ assets }: { assets: AudioAsset[] }) {
  return (
    <div className="flex flex-col gap-2">
      {assets.map((asset) => (
        <div key={asset.id} className="rounded-[7px] border border-white/10 bg-black/35 px-2 py-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate font-bold">{asset.label}</span>
            <span className="shrink-0 uppercase tracking-[0.12em] text-white/45">{asset.kind}</span>
          </div>
          <audio controls loop={asset.kind === 'music'} src={asset.src} className="h-[30px] w-full" />
        </div>
      ))}
    </div>
  )
}

export function SandboxPanel({
  state,
  onStart,
  onExit,
  onLock,
  onWeapon,
  onFire,
  onRefill,
  onSpawnEnemy,
  onDamage,
  onSpawnPickup,
  onClear,
}: Props) {
  const [spawnCount, setSpawnCount] = useState(3)
  const [assetFilter, setAssetFilter] = useState<(typeof ASSET_FILTERS)[number]>('sprite')
  const panelRef = useRef<HTMLDivElement>(null)
  const filteredAssets = useMemo(
    () =>
      assetFilter === 'all'
        ? VISUAL_ASSETS
        : assetFilter === 'audio'
          ? []
          : VISUAL_ASSETS.filter((asset) => asset.kind === assetFilter),
    [assetFilter],
  )
  const activeWeapon = WEAPON_ORDER.find((id) => WEAPONS[id].name === state.weapon) ?? STARTING_WEAPON
  const needsLock = state.status === 'pointerlock-needed' || state.status === 'paused'

  useEffect(() => {
    if (state.status !== 'playing') return

    const scrollLabsPanel = (event: WheelEvent) => {
      if (event.defaultPrevented) return
      const panel = panelRef.current
      if (!panel) return
      event.preventDefault()
      panel.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: 'auto' })
    }

    window.addEventListener('wheel', scrollLabsPanel, { passive: false })
    return () => window.removeEventListener('wheel', scrollLabsPanel)
  }, [state.status])

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      <div
        ref={panelRef}
        className="absolute left-3 top-3 flex max-h-[calc(100vh-24px)] w-[min(440px,94vw)] flex-col gap-3 overflow-y-auto rounded-[8px] border border-[#4b4a48] bg-[#0b0b0d]/95 p-3 text-[#e9e3d6] shadow-[0_24px_80px_-30px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,106,0,0.18)] backdrop-blur"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6a00]">Dev Sandbox</div>
            <h1 className="m-0 text-[24px] font-black leading-none tracking-[0.03em]">Scourge Labs</h1>
            <p className="m-0 mt-1 text-[12px] leading-[1.35] text-white/58">Real arena, weapons, foes, pickups, and runtime assets.</p>
          </div>
          <LabButton danger onClick={onExit}>Exit</LabButton>
        </header>

        <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
          <div className="rounded-[7px] bg-white/[0.06] px-2 py-2">
            <div className="text-white/45">Map</div>
            <div className="truncate font-black">{state.mapName}</div>
          </div>
          <div className="rounded-[7px] bg-white/[0.06] px-2 py-2">
            <div className="text-white/45">Foes</div>
            <div className="font-black">{state.enemiesAlive}</div>
          </div>
          <div className="rounded-[7px] bg-white/[0.06] px-2 py-2">
            <div className="text-white/45">Weapon</div>
            <div className="truncate font-black">{state.weapon}</div>
          </div>
          <div className="rounded-[7px] bg-white/[0.06] px-2 py-2">
            <div className="text-white/45">Ammo</div>
            <div className="font-black">{state.ammo}</div>
          </div>
        </div>

        <Section title="Session">
          <div className="grid grid-cols-2 gap-2">
            <LabButton active={needsLock} onClick={onLock}>{needsLock ? 'Resume / Lock' : 'Pointer Locked'}</LabButton>
            <LabButton onClick={() => onStart()}>Reset Sandbox</LabButton>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MAP_PICKER.map((map) => (
              <LabButton
                key={map.id}
                active={state.mapName === map.name}
                onClick={() => onStart(map.id)}
                className="justify-start text-left"
              >
                <span style={{ '--map-accent': map.accent } as CSSProperties} className="text-[var(--map-accent)]">{map.icon}</span> {map.name}
              </LabButton>
            ))}
          </div>
        </Section>

        <Section title="Weapons">
          <div className="grid grid-cols-5 gap-2">
            {WEAPON_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={cx(
                  'pointer-events-auto flex min-h-[74px] flex-col items-center justify-center gap-1 rounded-[7px] border bg-black/40 px-1 py-2 text-[10px] font-black uppercase tracking-[0.04em]',
                  activeWeapon === id ? 'border-[#ff6a00] text-[#ffb26b]' : 'border-white/10 text-white/70 hover:border-[#ff6a00]/50',
                )}
                onClick={() => onWeapon(id)}
              >
                <img src={WEAPON_IMAGES[id]} alt="" className="h-[36px] max-w-full object-contain" draggable={false} />
                {WEAPONS[id].name}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <LabButton onClick={onFire}>Fire Once</LabButton>
            <LabButton onClick={onRefill}>Refill</LabButton>
            <LabButton onClick={() => onDamage(90, true)}>Headshot Nearest</LabButton>
          </div>
        </Section>

        <Section title="Foes + Reactions" defaultOpen={false}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.12em] text-white/45">Count</span>
            <input
              type="range"
              min={1}
              max={12}
              value={spawnCount}
              onChange={(event) => setSpawnCount(Number(event.currentTarget.value))}
              className="pointer-events-auto flex-1 accent-[#ff6a00]"
            />
            <span className="w-6 text-right text-[12px] font-black">{spawnCount}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <LabButton onClick={() => onSpawnEnemy('melee', spawnCount)}>Spawn Melee</LabButton>
            <LabButton onClick={() => onSpawnEnemy('ranged', spawnCount)}>Spawn Ranged</LabButton>
            <LabButton onClick={() => onSpawnEnemy('flying', spawnCount)}>Spawn Flying</LabButton>
            <LabButton onClick={() => onSpawnEnemy('boss', 1)}>Spawn Boss</LabButton>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <LabButton onClick={() => onDamage(18)}>Tap Nearest</LabButton>
            <LabButton onClick={() => onDamage(70)}>Body Hit</LabButton>
            <LabButton onClick={() => onDamage(-1)}>Kill Nearest</LabButton>
            <LabButton onClick={() => onDamage(35, false, true)}>Hit All</LabButton>
            <LabButton onClick={() => onDamage(100, true, true)}>Headshot All</LabButton>
            <LabButton danger onClick={onClear}>Clear Lab</LabButton>
          </div>
        </Section>

        <Section title="Pickups" defaultOpen={false}>
          <div className="grid grid-cols-5 gap-2">
            {PICKUP_KINDS.map((kind) => (
              <LabButton key={kind} onClick={() => onSpawnPickup(kind)}>
                {kind}
              </LabButton>
            ))}
          </div>
        </Section>

        <Section title="Runtime Assets" defaultOpen={false}>
          <div className="mb-2 grid grid-cols-5 gap-1">
            {ASSET_FILTERS.map((filter) => (
              <LabButton key={filter} active={assetFilter === filter} onClick={() => setAssetFilter(filter)} className="px-1 text-[10px]">
                {filter}
              </LabButton>
            ))}
          </div>
          {assetFilter === 'audio' ? <AudioList assets={AUDIO_ASSETS} /> : <AssetGrid assets={filteredAssets} />}
        </Section>
      </div>
    </div>
  )
}
