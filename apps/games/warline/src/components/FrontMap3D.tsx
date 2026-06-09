import lobbyMusicUrl from "@shipshitgames/assets/games/warline/audio/music/doom-you-got-the-chainsaw.webm";
import greenGateSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/green-gate.webp";
import greenLiftSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/green-lift.webp";
import mawSpireSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/maw-spire.webp";
import orangePortalSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/orange-portal.webp";
import redAltarSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/red-altar.webp";
import wallGateSpriteUrl from "@shipshitgames/assets/games/warline/props/portal-deck/wall-gate.webp";
import blockTextureUrl from "@shipshitgames/assets/games/warline/textures/portal-deck/block.webp";
import columnTextureUrl from "@shipshitgames/assets/games/warline/textures/portal-deck/column.webp";
import decalTextureUrl from "@shipshitgames/assets/games/warline/textures/portal-deck/decal.webp";
import floorTextureUrl from "@shipshitgames/assets/games/warline/textures/portal-deck/floor.webp";
import wallTextureUrl from "@shipshitgames/assets/games/warline/textures/portal-deck/wall.webp";
import menuHero from "@shipshitgames/assets/games/warline/ui/menu/title.webp";
import {
  clearMoveIntent,
  firstPersonPointerLock,
  InputSystem,
  makeMoveIntent,
  RectBounds,
} from "@shipshitgames/engine";
import {
  GameSettingsScreen,
  loadGlobalGameSettings,
  MusicDirector,
  PauseMenu,
  subscribeGlobalGameSettings,
  toggleGlobalMusicMuted,
} from "@shipshitgames/ui";
import type { Faction, GameSlug, HumanFaction, Summary, WorldState } from "@shipshitgames/warline";
import { GAME_OPERATIONS, regionById } from "@shipshitgames/warline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { WarlineStatus } from "../store";

interface FrontMap3DProps {
  state: WorldState;
  summary: Summary;
  status: WarlineStatus;
  faction: HumanFaction;
  onOpenCommand: () => void;
  onExitToTitle?: () => void;
  /** When true the war map lifts off the table into a hologram. */
  commandActive?: boolean;
}

interface PortalDef {
  slug: GameSlug;
  title: string;
  href: string;
  devPort: number;
  regionId: string;
  bay: string;
  position: [number, number];
  accent: number;
  accentCss: string;
  spriteUrl: string;
  spriteScale: [number, number];
  spriteY: number;
}

interface PortalRuntime {
  def: PortalDef;
  group: THREE.Group;
  veil: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
  light: THREE.PointLight;
  pad: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
}

interface TableRegionRuntime {
  id: string;
  mat: THREE.MeshBasicMaterial;
  breach?: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
}

interface TableLaneRuntime {
  id: string;
  mat: THREE.LineBasicMaterial;
}

const PORTALS: PortalDef[] = [
  {
    slug: "scourge-survivors",
    title: "Scourge Survivors",
    href: "/scourge-survivors/",
    devPort: 5178,
    regionId: "maw",
    bay: "Breach Drop",
    position: [-27, -25],
    accent: 0xff6a00,
    accentCss: "#ff6a00",
    spriteUrl: orangePortalSpriteUrl,
    spriteScale: [5.4, 6.45],
    spriteY: 2.65,
  },
  {
    slug: "deadlane",
    title: "Deadlane",
    href: "/deadlane/",
    devPort: 5174,
    regionId: "hollowlanes",
    bay: "Lane Hold",
    position: [0, -33],
    accent: 0xc1121f,
    accentCss: "#c1121f",
    spriteUrl: wallGateSpriteUrl,
    spriteScale: [5.2, 5.2],
    spriteY: 2.55,
  },
  {
    slug: "pactfall",
    title: "Pactfall",
    href: "/pactfall/",
    devPort: 5175,
    regionId: "rustmarch",
    bay: "Arena Gate",
    position: [28, -22],
    accent: 0xe9e3d6,
    accentCss: "#e9e3d6",
    spriteUrl: greenGateSpriteUrl,
    spriteScale: [5.5, 5.95],
    spriteY: 2.55,
  },
  {
    slug: "starblight",
    title: "Starblight",
    href: "/starblight/",
    devPort: 5179,
    regionId: "skyhook",
    bay: "Orbital Lift",
    position: [31, 18],
    accent: 0x8bdc1f,
    accentCss: "#8bdc1f",
    spriteUrl: greenLiftSpriteUrl,
    spriteScale: [4.9, 6.75],
    spriteY: 2.65,
  },
  {
    slug: "redline",
    title: "Redline",
    href: "/redline/",
    devPort: 5176,
    regionId: "ashgate",
    bay: "Courier Exit",
    position: [0, 33],
    accent: 0xff2a18,
    accentCss: "#ff2a18",
    spriteUrl: redAltarSpriteUrl,
    spriteScale: [5.8, 5.8],
    spriteY: 2.7,
  },
  {
    slug: "rothulk",
    title: "Rothulk",
    href: "/rothulk/",
    devPort: 5177,
    regionId: "cinder",
    bay: "Hulk Descent",
    position: [-30, 18],
    accent: 0xcdbfae,
    accentCss: "#cdbfae",
    spriteUrl: mawSpireSpriteUrl,
    spriteScale: [5.35, 6.2],
    spriteY: 2.7,
  },
];

const FACTION_COLOR: Record<Faction, number> = {
  wardens: 0xc1121f,
  pyre: 0xff6a00,
  scourge: 0x8bdc1f,
  neutral: 0x34343c,
};

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.72;
const MOVE_SPEED = 8.25;
const PORTAL_TRIGGER_RADIUS = 4.75;
const TABLE_TRIGGER_RADIUS = 8;
const JUMP_VELOCITY = 7.6;
const GRAVITY = 22;
const LOBBY_MUSIC = {
  id: "warline-lobby",
  tracks: [{ id: "chainsaw", url: lobbyMusicUrl }],
  loop: true,
};

export function FrontMap3D({
  state,
  summary,
  status,
  faction,
  onOpenCommand,
  onExitToTitle,
  commandActive = false,
}: FrontMap3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  const summaryRef = useRef(summary);
  const nearestRef = useRef<GameSlug | null>(null);
  const nearTableRef = useRef(false);
  const launchRef = useRef<(slug: GameSlug) => void>(() => {});
  const commandRef = useRef(onOpenCommand);
  const commandActiveRef = useRef(commandActive);
  const requestCaptureRef = useRef<() => void>(() => {});
  const pauseRef = useRef<() => void>(() => {});
  const resumeRef = useRef<() => void>(() => {});
  const playMusicRef = useRef<() => void>(() => {});
  const pauseMusicRef = useRef<() => void>(() => {});
  const directorRef = useRef<MusicDirector | null>(null);
  const controlActiveRef = useRef(false);
  const pausedRef = useRef(false);

  const [nearest, setNearest] = useState<GameSlug | null>(null);
  const [nearTable, setNearTable] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [paused, setPausedState] = useState(false);
  const [pauseSettings, setPauseSettings] = useState(false);
  // "Mute Music"/"Music On" label mirrors the shared global mute (same state the
  // title-menu corner toggle + settings sliders drive).
  const [musicEnabled, setMusicEnabled] = useState(() =>
    typeof window === "undefined" ? true : !loadGlobalGameSettings().musicMuted,
  );
  const pauseStatus = useMemo(
    () => (
      <>
        <span>{summary.regionsHuman} pact sectors holding</span>
        <span>Threat {Math.round(summary.threat)}%</span>
      </>
    ),
    [summary.regionsHuman, summary.threat],
  );
  const pauseActions = useMemo(
    () => [
      { id: "command", label: "Command Table", meta: "War map", variant: "shop" as const, onSelect: onOpenCommand },
      {
        id: "settings",
        label: "Settings",
        meta: "Audio",
        variant: "settings" as const,
        onSelect: () => setPauseSettings(true),
      },
      { id: "title", label: "Exit to title", meta: "Main menu", onSelect: () => onExitToTitle?.() },
    ],
    [onExitToTitle, onOpenCommand],
  );

  useEffect(() => {
    const portal = PORTALS.find((p) => normalizePath(window.location.pathname) === normalizePath(p.href));
    if (portal && shouldUseLocalGamePort()) {
      window.location.replace(resolvePortalHref(portal));
    }
  }, []);

  useEffect(() => {
    stateRef.current = state;
    summaryRef.current = summary;
  }, [state, summary]);

  useEffect(() => {
    commandRef.current = onOpenCommand;
    commandActiveRef.current = commandActive;
  }, [onOpenCommand, commandActive]);

  useEffect(() => subscribeGlobalGameSettings((s) => setMusicEnabled(!s.musicMuted)), []);

  useEffect(() => {
    // Lobby music rides the shared MusicDirector: it routes through the global
    // music volume + mute, so the title-menu sliders and corner mute control it.
    const director = new MusicDirector({ baseGain: 0.42 });
    directorRef.current = director;
    playMusicRef.current = () => {
      director.resume();
      director.play(LOBBY_MUSIC);
    };
    pauseMusicRef.current = () => director.stop();

    return () => {
      director.dispose();
      directorRef.current = null;
      playMusicRef.current = () => {};
      pauseMusicRef.current = () => {};
    };
  }, []);

  const launchPortal = useCallback((slug: GameSlug) => {
    const portal = PORTALS.find((p) => p.slug === slug);
    if (!portal) return;
    window.location.assign(resolvePortalHref(portal));
  }, []);

  const toggleMusic = useCallback(() => {
    // Flip the shared global mute; the subscription updates the label and the
    // director silences/unsilences via its master gain.
    toggleGlobalMusicMuted();
  }, []);

  useEffect(() => {
    launchRef.current = launchPortal;
  }, [launchPortal]);

  const nearestPortal = useMemo(() => PORTALS.find((portal) => portal.slug === nearest) ?? null, [nearest]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x080808, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = "front-map3d__canvas";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0806);
    scene.fog = new THREE.Fog(0x0b0806, 28, 112);

    const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 180);
    scene.add(camera);

    const rig = firstPersonPointerLock(camera, renderer.domElement);
    rig.placeAt(0, PLAYER_HEIGHT, 24, 0, -1);
    rig.setFov(72);
    let verticalVelocity = 0;
    let grounded = true;
    const setControlActive = (next: boolean) => {
      controlActiveRef.current = next;
    };
    const setPaused = (next: boolean) => {
      pausedRef.current = next;
      setPausedState(next);
    };
    const activateControls = () => {
      setPaused(false);
      setControlActive(true);
      playMusicRef.current();
      try {
        rig.requestCapture();
      } catch {
        // Some browsers/contexts refuse pointer lock. Keyboard movement and
        // mouse-delta look still work through the soft-capture fallback below.
      }
    };
    const pauseControls = () => {
      setPaused(true);
      setPauseSettings(false); // each pause opens on the menu, not the settings panel
      setControlActive(false);
      clearMoveIntent(move);
      // Keep the music playing through the pause — only stop it on unmount.
      rig.releaseCapture(true);
    };
    const resumeControls = () => activateControls();
    requestCaptureRef.current = activateControls;
    pauseRef.current = pauseControls;
    resumeRef.current = resumeControls;

    // No "Enter Front" gate: WASD movement + E-interaction are live the moment
    // the lobby mounts. Mouse-look is opt-in by clicking the floor (pointer
    // lock); the shared pause menu (Esc / Pause) is the only modal.
    setControlActive(true);
    playMusicRef.current();

    const bounds = RectBounds.square(39);
    const move = makeMoveIntent();
    const raycaster = new THREE.Raycaster();
    let raf = 0;
    let prevCommandActive = false;
    let lastFrame = performance.now();
    const startedAt = lastFrame;

    const sceneRuntime = buildFrontScene(scene, stateRef.current);
    const obstacleBoxes = sceneRuntime.colliders.map((mesh) => new THREE.Box3().setFromObject(mesh));
    rig.setColliders(sceneRuntime.colliders);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      rig.resize(width / height);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const input = new InputSystem({
      move,
      isActive: () => !pausedRef.current && !commandActiveRef.current,
      onPointerDown: (_button, event) => {
        // Click the floor to grab pointer-lock mouse-look (optional) — never required to move.
        if (event.target === renderer.domElement && !pausedRef.current && !commandActiveRef.current && !rig.captured) {
          playMusicRef.current();
          try {
            rig.requestCapture();
          } catch {
            /* pointer lock refused — WASD + E still work */
          }
        }
      },
      onJump: () => {
        if (!grounded || pausedRef.current) return;
        verticalVelocity = JUMP_VELOCITY;
        grounded = false;
      },
      onActionKey: (code, event) => {
        if (code === "Escape") {
          event.preventDefault();
          pauseControls();
          return;
        }
        if (code === "KeyE") {
          event.preventDefault();
          // Standing at the Command Table opens the war map; otherwise E enters
          // the nearest portal.
          if (nearTableRef.current) {
            commandRef.current();
            rig.releaseCapture(true); // free the cursor for the command rail
          } else if (nearestRef.current) {
            launchRef.current(nearestRef.current);
          }
        }
        if (code === "KeyM" || code === "Tab") {
          event.preventDefault();
          commandRef.current();
          rig.releaseCapture(true);
        }
      },
      onResumeKey: () => {
        if (pausedRef.current) resumeControls();
        else activateControls();
      },
      onResize: resize,
      suppressContextMenu: () => true,
    });
    input.bind();

    const updateCapture = () => {
      setCaptured(rig.captured);
      if (rig.captured) setControlActive(true);
    };
    rig.on("capture", updateCapture);
    rig.on("release", updateCapture);

    const animate = () => {
      const now = performance.now();
      const delta = Math.min((now - lastFrame) / 1000, 0.05);
      const time = (now - startedAt) / 1000;
      lastFrame = now;
      if (!pausedRef.current) {
        updateJump(
          rig,
          delta,
          () => verticalVelocity,
          (next) => {
            verticalVelocity = next;
          },
          (next) => {
            grounded = next;
          },
        );
        updateMovement(rig, move, bounds, obstacleBoxes, delta);
      }
      updateDynamicScene(sceneRuntime, stateRef.current, time);

      // Lift the war map off the table into a slowly-spinning hologram while the
      // Command Table is engaged; settle it back onto the table otherwise.
      const holo = sceneRuntime.tableHolo;
      const holoT = commandActiveRef.current ? 1 : 0;
      const ease = 1 - (1 - Math.min(1, delta * 4));
      holo.position.y += (holoT * 2.6 - holo.position.y) * ease;
      const targetScale = 1 + holoT * 0.85;
      holo.scale.x += (targetScale - holo.scale.x) * ease;
      holo.scale.y += (targetScale - holo.scale.y) * ease;
      holo.scale.z += (targetScale - holo.scale.z) * ease;
      if (commandActiveRef.current) holo.rotation.y += delta * 0.25;
      else holo.rotation.y += (0 - holo.rotation.y) * ease;

      // On engaging the Command Table, step the camera back to frame the table +
      // its rising hologram (movement/look are frozen while commanding).
      if (commandActiveRef.current && !prevCommandActive) {
        rig.placeAt(0, 3.2, 9.5, 0, -1);
      }
      prevCommandActive = commandActiveRef.current;

      const nextNearest = nearestPortalFor(rig.body.position, sceneRuntime.portals);
      if (nextNearest !== nearestRef.current) {
        nearestRef.current = nextNearest;
        setNearest(nextNearest);
      }

      // The Command Table sits at the origin — flag when the player is close
      // enough to open it with E.
      const nextNearTable = Math.hypot(rig.body.position.x, rig.body.position.z) < TABLE_TRIGGER_RADIUS;
      if (nextNearTable !== nearTableRef.current) {
        nearTableRef.current = nextNearTable;
        setNearTable(nextNearTable);
      }

      const reticleTarget = sceneRuntime.portals.find((portal) => portal.def.slug === nextNearest);
      if (reticleTarget) {
        const target = reticleTarget.group.getWorldPosition(new THREE.Vector3());
        target.y += 2.1;
        raycaster.set(rig.body.position, target.sub(rig.body.position).normalize());
      }

      rig.update(delta);
      renderer.render(scene, camera);
      if (!sceneRuntime.disposed) raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      requestCaptureRef.current = () => {};
      pauseRef.current = () => {};
      resumeRef.current = () => {};
      sceneRuntime.disposed = true;
      if (raf) cancelAnimationFrame(raf);
      input.unbind();
      rig.off("capture", updateCapture);
      rig.off("release", updateCapture);
      rig.dispose();
      resizeObserver.disconnect();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <section className="front-map3d" aria-label="Warline playable front">
      <div ref={mountRef} className="front-map3d__stage" />

      <div className="front-map3d__hud front-map3d__hud--top">
        <div className="front-map3d__plate">
          <span className="front-map3d__kicker">WARLINE FRONT</span>
          <strong>{summary.regionsHuman} pact sectors holding</strong>
          <span>
            Threat {Math.round(summary.threat)} / {status} / {faction.toUpperCase()}
          </span>
        </div>

        <div className="front-map3d__actions">
          <button type="button" className="front-map3d__button" onClick={toggleMusic}>
            {musicEnabled ? "Mute Music" : "Music On"}
          </button>
          <button type="button" className="front-map3d__button" onClick={onOpenCommand}>
            Command Table
          </button>
          <button type="button" className="front-map3d__button" onClick={() => pauseRef.current()}>
            Pause
          </button>
        </div>
      </div>

      {!captured && !paused && (
        <div className="front-map3d__hint" aria-hidden="true">
          <span>
            <kbd>WASD</kbd> move
          </span>
          <span>Click to look</span>
          <span>
            <kbd>E</kbd> enter · <kbd>Esc</kbd> pause
          </span>
        </div>
      )}

      <PauseMenu
        open={paused && !pauseSettings}
        kicker="Warline Front"
        title="Paused"
        subtitle="The lanes hold while you stand at the threshold."
        status={pauseStatus}
        onResume={() => resumeRef.current()}
        actions={pauseActions}
      />

      {paused && pauseSettings && (
        <GameSettingsScreen
          open
          onClose={() => setPauseSettings(false)}
          kicker="Audio Settings"
          backgroundImage={menuHero}
        />
      )}

      {nearTable && !paused && (
        <div className="front-map3d__portal-panel" style={{ "--portal-accent": "#ff6a00" } as React.CSSProperties}>
          <span className="front-map3d__kicker">Warline Command</span>
          <strong>Command Table</strong>
          <span>Open the war map for the lanes.</span>
          <div className="front-map3d__prompt">
            Press <kbd>E</kbd> to open
          </div>
        </div>
      )}

      {nearestPortal && !nearTable && (
        <div
          className="front-map3d__portal-panel"
          style={{ "--portal-accent": nearestPortal.accentCss } as React.CSSProperties}
        >
          <span className="front-map3d__kicker">{nearestPortal.bay}</span>
          <strong>{nearestPortal.title}</strong>
          <span>{GAME_OPERATIONS[nearestPortal.slug].label}</span>
          <div className="front-map3d__prompt">
            Press <kbd>E</kbd> to enter
          </div>
        </div>
      )}
    </section>
  );
}

function updateJump(
  rig: ReturnType<typeof firstPersonPointerLock>,
  delta: number,
  getVelocity: () => number,
  setVelocity: (next: number) => void,
  setGrounded: (next: boolean) => void,
) {
  let velocity = getVelocity();
  if (velocity === 0 && rig.body.position.y <= PLAYER_HEIGHT) {
    setGrounded(true);
    return;
  }
  rig.body.position.y += velocity * delta;
  velocity -= GRAVITY * delta;
  if (rig.body.position.y <= PLAYER_HEIGHT) {
    rig.body.position.y = PLAYER_HEIGHT;
    velocity = 0;
    setGrounded(true);
  } else {
    setGrounded(false);
  }
  setVelocity(velocity);
}

function resolvePortalHref(portal: PortalDef): string {
  if (shouldUseLocalGamePort()) {
    return `${window.location.protocol}//${window.location.hostname}:${portal.devPort}/`;
  }
  return portal.href;
}

function shouldUseLocalGamePort(): boolean {
  const isLocalHost = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  return import.meta.env.DEV && isLocalHost;
}

function normalizePath(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

function updateMovement(
  rig: ReturnType<typeof firstPersonPointerLock>,
  move: ReturnType<typeof makeMoveIntent>,
  bounds: RectBounds,
  obstacleBoxes: THREE.Box3[],
  delta: number,
) {
  const forward = (move.forward ? 1 : 0) - (move.back ? 1 : 0);
  const right = (move.right ? 1 : 0) - (move.left ? 1 : 0);
  if (forward === 0 && right === 0) return;

  const len = Math.hypot(forward, right) || 1;
  const stepRight = (right / len) * MOVE_SPEED * delta;
  const stepForward = (forward / len) * MOVE_SPEED * delta;

  const prevX = rig.body.position.x;
  const prevZ = rig.body.position.z;
  rig.movePlanar(stepRight, stepForward);
  bounds.clampXZ(rig.body.position, 1.25);
  if (collides(rig.body.position.x, rig.body.position.z, obstacleBoxes)) {
    rig.body.position.x = prevX;
    rig.body.position.z = prevZ;
    tryMoveAxis(rig, bounds, obstacleBoxes, stepRight, 0);
    tryMoveAxis(rig, bounds, obstacleBoxes, 0, stepForward);
  }
}

function tryMoveAxis(
  rig: ReturnType<typeof firstPersonPointerLock>,
  bounds: RectBounds,
  obstacleBoxes: THREE.Box3[],
  stepRight: number,
  stepForward: number,
) {
  if (stepRight === 0 && stepForward === 0) return;
  const prevX = rig.body.position.x;
  const prevZ = rig.body.position.z;
  rig.movePlanar(stepRight, stepForward);
  bounds.clampXZ(rig.body.position, 1.25);
  if (collides(rig.body.position.x, rig.body.position.z, obstacleBoxes)) {
    rig.body.position.x = prevX;
    rig.body.position.z = prevZ;
  }
}

function collides(x: number, z: number, boxes: THREE.Box3[]): boolean {
  for (const box of boxes) {
    if (
      x >= box.min.x - PLAYER_RADIUS &&
      x <= box.max.x + PLAYER_RADIUS &&
      z >= box.min.z - PLAYER_RADIUS &&
      z <= box.max.z + PLAYER_RADIUS
    ) {
      return true;
    }
  }
  return false;
}

function nearestPortalFor(position: THREE.Vector3, portals: PortalRuntime[]): GameSlug | null {
  let nearest: GameSlug | null = null;
  let best = PORTAL_TRIGGER_RADIUS;
  for (const portal of portals) {
    const [x, z] = portal.def.position;
    const dist = Math.hypot(position.x - x, position.z - z);
    if (dist < best) {
      best = dist;
      nearest = portal.def.slug;
    }
  }
  return nearest;
}

function buildFrontScene(scene: THREE.Scene, state: WorldState) {
  const textureLoader = new THREE.TextureLoader();
  const colliders: THREE.Mesh[] = [];
  const portals: PortalRuntime[] = [];
  const tableRegions: TableRegionRuntime[] = [];
  const tableLanes: TableLaneRuntime[] = [];

  scene.add(new THREE.HemisphereLight(0xe9e3d6, 0x130a06, 1.25));

  const key = new THREE.DirectionalLight(0xffb36c, 2.3);
  key.position.set(-18, 26, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 90;
  scene.add(key);

  const toxic = new THREE.PointLight(0x8bdc1f, 2.2, 48, 1.8);
  toxic.position.set(20, 5, -18);
  scene.add(toxic);

  const floorTexture = makeTexture(textureLoader, floorTextureUrl, 12, 12);
  const wallTexture = makeTexture(textureLoader, wallTextureUrl, 6, 2);
  const blockTexture = makeTexture(textureLoader, blockTextureUrl, 2, 2);
  const columnTexture = makeTexture(textureLoader, columnTextureUrl, 1, 2);
  const decalTexture = makeTexture(textureLoader, decalTextureUrl, 1, 1);

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    color: 0xb89274,
    roughness: 0.9,
    metalness: 0.08,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTexture,
    color: 0x8b6d5a,
    roughness: 0.66,
    metalness: 0.24,
  });
  const blockMat = new THREE.MeshStandardMaterial({
    map: blockTexture,
    color: 0x8c7667,
    roughness: 0.74,
    metalness: 0.18,
  });
  const columnMat = new THREE.MeshStandardMaterial({
    map: columnTexture,
    color: 0xa68a72,
    roughness: 0.58,
    metalness: 0.34,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(86, 86), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  addBoundaryWalls(scene, wallMat, colliders);
  addRunways(scene, PORTALS);
  const tableHolo = addCommandTable(scene, state, tableRegions, tableLanes, colliders);
  addObstacles(scene, blockMat, columnMat, colliders);
  addDecals(scene, decalTexture);

  for (const portal of PORTALS) portals.push(addPortal(scene, textureLoader, portal, colliders));

  return { colliders, portals, tableRegions, tableLanes, tableHolo, disposed: false };
}

function makeTexture(loader: THREE.TextureLoader, url: string, repeatX: number, repeatY: number) {
  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

function addBoundaryWalls(scene: THREE.Scene, wallMat: THREE.Material, colliders: THREE.Mesh[]) {
  const half = 43;
  const thickness = 2.8;
  const height = 5.5;
  const span = half * 2 + thickness;
  const defs: Array<[number, number, number, number]> = [
    [0, -half, span, thickness],
    [0, half, span, thickness],
    [-half, 0, thickness, span],
    [half, 0, thickness, span],
  ];
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff6a00, emissiveIntensity: 1.2 });

  for (const [x, z, w, d] of defs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), wallMat);
    wall.position.set(x, height / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    colliders.push(wall);

    const longX = w >= d;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(longX ? w : 0.1, 0.08, longX ? 0.1 : d), trimMat);
    trim.position.set(x, height - 0.08, z);
    scene.add(trim);
  }
}

function addRunways(scene: THREE.Scene, portals: PortalDef[]) {
  for (const portal of portals) {
    const [x, z] = portal.position;
    const length = Math.max(1, Math.hypot(x, z));
    const mat = new THREE.MeshBasicMaterial({
      color: portal.accent,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const runway = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, length), mat);
    runway.position.set(x / 2, 0.035, z / 2);
    runway.rotation.y = Math.atan2(x, z);
    scene.add(runway);
  }
}

function addCommandTable(
  scene: THREE.Scene,
  state: WorldState,
  regions: TableRegionRuntime[],
  lanes: TableLaneRuntime[],
  colliders: THREE.Mesh[],
): THREE.Group {
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e1e22, roughness: 0.55, metalness: 0.48 });
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    emissive: 0x2a0905,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.86,
    roughness: 0.38,
    metalness: 0.35,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.46, 3.25), baseMat);
  base.position.set(0, 0.28, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  scene.add(base);
  colliders.push(base);

  const top = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.08, 6.25), topMat);
  top.position.set(0, 0.68, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  scene.add(top);

  const glow = new THREE.PointLight(0xff6a00, 1.2, 16, 2.1);
  glow.position.set(0, 1.85, 0);
  scene.add(glow);

  // The war map (lanes + region nodes + breaches) lives in its own group so it
  // can lift off the table into a hologram when the Command Table is engaged.
  const holo = new THREE.Group();
  scene.add(holo);

  for (const lane of state.lanes) {
    const from = regionById(state, lane.from);
    const to = regionById(state, lane.to);
    if (!from || !to) continue;
    const a = mapPointToTable(from.x, from.y);
    const b = mapPointToTable(to.x, to.y);
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, 0.78, a.z),
      new THREE.Vector3(b.x, 0.78, b.z),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: FACTION_COLOR[lane.control], transparent: true, opacity: 0.7 });
    holo.add(new THREE.Line(geom, mat));
    lanes.push({ id: lane.id, mat });
  }

  for (const region of state.regions) {
    const p = mapPointToTable(region.x, region.y);
    const mat = new THREE.MeshBasicMaterial({ color: FACTION_COLOR[region.faction] });
    const node = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 18), mat);
    node.position.set(p.x, 0.84, p.z);
    node.rotation.x = Math.PI / 2;
    holo.add(node);

    let breach: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | undefined;
    if (region.breachId) {
      breach = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.018, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x8bdc1f, transparent: true, opacity: 0.8 }),
      );
      breach.position.set(p.x, 0.88, p.z);
      breach.rotation.x = Math.PI / 2;
      holo.add(breach);
    }

    regions.push({ id: region.id, mat, breach });
  }

  return holo;
}

function mapPointToTable(x: number, y: number) {
  return {
    x: ((x - 50) / 100) * 8.8,
    z: ((y - 50) / 100) * 4.9,
  };
}

function addObstacles(
  scene: THREE.Scene,
  blockMat: THREE.Material,
  columnMat: THREE.Material,
  colliders: THREE.Mesh[],
) {
  const defs: Array<{ x: number; z: number; w: number; h: number; d: number; mat: THREE.Material }> = [
    { x: -15, z: 7, w: 6.5, h: 2.2, d: 3.2, mat: blockMat },
    { x: 15, z: -7, w: 6.5, h: 2.2, d: 3.2, mat: blockMat },
    { x: 18, z: 13, w: 3.2, h: 3.8, d: 3.2, mat: columnMat },
    { x: -18, z: -13, w: 3.2, h: 3.8, d: 3.2, mat: columnMat },
    { x: -7, z: 19, w: 4.2, h: 2.8, d: 3.6, mat: blockMat },
    { x: 8, z: -19, w: 4.2, h: 2.8, d: 3.6, mat: blockMat },
  ];

  for (const def of defs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.d), def.mat);
    mesh.position.set(def.x, def.h / 2, def.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push(mesh);
  }
}

function addDecals(scene: THREE.Scene, texture: THREE.Texture) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xff6a00,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const spots: Array<[number, number, number, number, number]> = [
    [-18, 21, 8, 10, 0.4],
    [19, -20, 9, 8, -0.2],
    [3, 14, 10, 6, 1.2],
    [-4, -16, 8, 9, -0.9],
  ];
  for (const [x, z, w, d, r] of spots) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat.clone());
    decal.position.set(x, 0.045, z);
    decal.rotation.set(-Math.PI / 2, 0, r);
    scene.add(decal);
  }
}

function addPortal(
  scene: THREE.Scene,
  loader: THREE.TextureLoader,
  def: PortalDef,
  colliders: THREE.Mesh[],
): PortalRuntime {
  const group = new THREE.Group();
  const [x, z] = def.position;
  group.position.set(x, 0, z);
  group.rotation.y = Math.atan2(-x, -z);

  const glow = new THREE.MeshStandardMaterial({
    color: def.accent,
    emissive: def.accent,
    emissiveIntensity: 1.6,
    roughness: 0.34,
    metalness: 0.24,
  });

  const body = makeSpritePlane(loader, def.spriteUrl, def.spriteScale, 0.16);
  body.position.set(0, def.spriteY, 0);
  body.renderOrder = 2;
  group.add(body);

  const colliderMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.25, 0.8), colliderMat);
  left.position.set(-1.55, 1.65, 0);
  const right = left.clone();
  right.position.x = 1.45;
  group.add(left, right);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.08, 12, 54), glow);
  ring.position.set(0, 1.85, 0.08);
  group.add(ring);

  const veil = new THREE.Mesh(
    new THREE.CircleGeometry(1.08, 48),
    new THREE.MeshBasicMaterial({
      color: def.accent,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  veil.position.set(0, 1.85, 0);
  group.add(veil);

  const pad = new THREE.Mesh(
    new THREE.RingGeometry(1.75, 2.3, 48),
    new THREE.MeshBasicMaterial({
      color: def.accent,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.07, 0.9);
  group.add(pad);

  const label = makeLabelSprite(def.title, GAME_OPERATIONS[def.slug].label, def.accentCss);
  label.position.set(0, def.spriteY + def.spriteScale[1] / 2 + 0.7, 0);
  group.add(label);

  const light = new THREE.PointLight(def.accent, 2.4, 17, 1.6);
  light.position.set(0, 2.2, 1.1);
  group.add(light);

  scene.add(group);
  group.updateWorldMatrix(true, true);
  colliders.push(left, right);
  return { def, group, veil, ring, light, pad };
}

function makeSpritePlane(loader: THREE.TextureLoader, url: string, scale: [number, number], alphaTest = 0.1) {
  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(scale[0], scale[1]), material);
}

function makeLabelSprite(title: string, subtitle: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Sprite();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(10,10,10,0.82)";
  ctx.fillRect(18, 22, 476, 128);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 22, 476, 128);
  ctx.fillStyle = "#e9e3d6";
  ctx.font = "700 34px Oswald, Arial Narrow, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title.toUpperCase(), 256, 78);
  ctx.fillStyle = accent;
  ctx.font = "700 20px monospace";
  ctx.fillText(subtitle.toUpperCase(), 256, 116);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(6.8, 2.55, 1);
  return sprite;
}

function updateDynamicScene(runtime: ReturnType<typeof buildFrontScene>, state: WorldState, time: number) {
  const breachesById = new Map(state.breaches.map((breach) => [breach.id, breach]));
  const lanesById = new Map(state.lanes.map((lane) => [lane.id, lane]));

  for (const portal of runtime.portals) {
    const region = regionById(state, portal.def.regionId);
    const heat = region ? Math.max(0, Math.min(1, region.pressure / 100)) : 0.4;
    const pulse = 0.5 + 0.5 * Math.sin(time * (2.2 + heat));
    portal.veil.material.opacity = 0.16 + heat * 0.3 + pulse * 0.08;
    portal.ring.material.emissiveIntensity = 1.1 + heat * 1.8 + pulse * 0.8;
    portal.light.intensity = 1.7 + heat * 2.4 + pulse * 0.7;
    portal.pad.material.opacity = 0.16 + heat * 0.18 + pulse * 0.1;
    portal.group.position.y = Math.sin(time * 1.3 + portal.def.position[0]) * 0.035;
  }

  for (const item of runtime.tableRegions) {
    const region = regionById(state, item.id);
    if (!region) continue;
    item.mat.color.setHex(region.revealed ? FACTION_COLOR[region.faction] : 0x1e1e22);
    if (item.breach) {
      const breach = region.breachId ? breachesById.get(region.breachId) : undefined;
      item.breach.visible = breach?.active ?? false;
      item.breach.material.opacity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(time * 3.5));
      item.breach.rotation.z += 0.015;
    }
  }

  for (const item of runtime.tableLanes) {
    const lane = lanesById.get(item.id);
    if (!lane) continue;
    item.mat.color.setHex(FACTION_COLOR[lane.control]);
    item.mat.opacity = 0.35 + Math.max(0.2, lane.flow / 120);
  }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      for (const item of material) disposeMaterial(item);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: THREE.Material) {
  const maybeMaps = material as THREE.Material & {
    map?: THREE.Texture;
    emissiveMap?: THREE.Texture;
    alphaMap?: THREE.Texture;
  };
  maybeMaps.map?.dispose();
  maybeMaps.emissiveMap?.dispose();
  maybeMaps.alphaMap?.dispose();
  material.dispose();
}
