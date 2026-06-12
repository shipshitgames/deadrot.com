import lobbyMusicUrl from "@shipshitgames/assets/games/warline/audio/music/doom-you-got-the-chainsaw.webm";
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
import type { GameSlug, HumanFaction, Summary, WorldState } from "@shipshitgames/warline";
import { GAME_OPERATIONS } from "@shipshitgames/warline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  createMoveState,
  JUMP_VELOCITY,
  PLAYER_HEIGHT,
  resetMoveState,
  updateJump,
  updateMovement,
} from "../front/movement";
import { normalizePath, PORTALS, resolvePortalHref, shouldUseLocalGamePort } from "../front/portals";
import type { PortalRuntime } from "../front/scene";
import { buildFrontScene, disposeObject, updateDynamicScene } from "../front/scene";
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

const PORTAL_TRIGGER_RADIUS = 4.75;
const TABLE_TRIGGER_RADIUS = 8;
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
    const jumpState = { velocity: 0, grounded: true };
    const moveState = createMoveState();
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
      resetMoveState(moveState);
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
        if (!jumpState.grounded || pausedRef.current) return;
        jumpState.velocity = JUMP_VELOCITY;
        jumpState.grounded = false;
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
        updateJump(rig, delta, jumpState);
        updateMovement(rig, move, moveState, bounds, obstacleBoxes, delta);
      }
      updateDynamicScene(sceneRuntime, stateRef.current, time);

      // Lift the war map off the table into a slowly-spinning hologram while the
      // Command Table is engaged; settle it back onto the table otherwise.
      const holo = sceneRuntime.tableHolo;
      const holoT = commandActiveRef.current ? 1 : 0;
      const ease = Math.min(1, delta * 4);
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
