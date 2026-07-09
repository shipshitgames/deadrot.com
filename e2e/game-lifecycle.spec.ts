import { expect, type Page, test } from "@playwright/test";

const AFFECTED_GAMES = new Set(["pactfall", "deadlane", "rothulk"]);

interface LifecycleMetrics {
  listeners: Record<string, number>;
  pendingFrames: number;
  frameCallbacks: number;
  canvases: number;
  webglContextsCreated: number;
  webglContextsLost: number;
  liveWebglContexts: number;
  audioContextsCreated: number;
  audioContextsClosed: number;
  liveAudioContexts: number;
}

test("mount -> dispose -> mount does not accumulate listeners, frames, or WebGL ownership", async ({
  page,
}, testInfo) => {
  const slug = testInfo.project.name.split(":")[0];
  test.skip(!AFFECTED_GAMES.has(slug), "Lifecycle regression only applies to the three affected games.");

  await installLifecycleInstrumentation(page);
  await page.goto("/");
  await waitForGameMount(page, slug);
  if (slug === "rothulk") {
    await page.evaluate(() => {
      (window as unknown as { __rothulkGame: { beginRun: () => void } }).__rothulkGame.beginRun();
    });
    await expect.poll(async () => (await readMetrics(page)).audioContextsCreated).toBeGreaterThan(0);
  }
  await page.waitForTimeout(200);

  const baseline = await readMetrics(page);
  const firstGeneration = await page.evaluate(() => {
    return (
      window as unknown as {
        __deadrotLifecycle: { generation: () => number };
      }
    ).__deadrotLifecycle.generation();
  });
  expect(baseline.pendingFrames).toBeGreaterThan(0);
  expect(baseline.canvases).toBe(1);
  expect(baseline.liveWebglContexts).toBe(1);

  for (let cycle = 1; cycle <= 3; cycle++) {
    await page.evaluate(() => {
      (
        window as unknown as {
          __deadrotLifecycle: { remount: () => void };
        }
      ).__deadrotLifecycle.remount();
    });
    await page.waitForFunction(
      ({ game, generation }) => {
        const win = window as unknown as {
          __deadrotLifecycle?: { generation: () => number };
          __pactfallGame?: unknown;
          __deadlaneGame?: unknown;
          __rothulkGame?: unknown;
        };
        const mountedGame =
          game === "pactfall" ? win.__pactfallGame : game === "deadlane" ? win.__deadlaneGame : win.__rothulkGame;
        return (
          win.__deadrotLifecycle?.generation() === generation &&
          Boolean(mountedGame) &&
          document.querySelectorAll("#scene").length === 1
        );
      },
      { game: slug, generation: firstGeneration + cycle },
    );
    await page.waitForTimeout(150);
  }

  await expect.poll(async () => (await readMetrics(page)).liveWebglContexts).toBeLessThanOrEqual(1);
  const after = await readMetrics(page);

  expect(after.canvases).toBe(1);
  expect(after.webglContextsCreated - baseline.webglContextsCreated).toBe(3);
  expect(after.webglContextsLost - baseline.webglContextsLost).toBeGreaterThanOrEqual(3);
  expect(after.liveWebglContexts).toBeLessThanOrEqual(1);
  expect(after.pendingFrames).toBeLessThanOrEqual(baseline.pendingFrames);
  for (const [type, count] of Object.entries(after.listeners)) {
    expect(count, `${type} listeners accumulated across remounts`).toBeLessThanOrEqual(baseline.listeners[type] ?? 0);
  }

  if (slug === "rothulk") {
    expect(after.audioContextsClosed - baseline.audioContextsClosed).toBeGreaterThanOrEqual(1);
    expect(after.liveAudioContexts).toBe(0);
  }

  if (slug === "deadlane") {
    const beforeIdle = await deadlaneHudPublications(page);
    await page.waitForTimeout(500);
    expect(await deadlaneHudPublications(page)).toBe(beforeIdle);
  }
});

async function waitForGameMount(page: Page, slug: string): Promise<void> {
  await page.waitForFunction((game) => {
    const win = window as unknown as {
      __deadrotLifecycle?: unknown;
      __pactfallGame?: unknown;
      __deadlaneGame?: unknown;
      __rothulkGame?: unknown;
    };
    const mountedGame =
      game === "pactfall" ? win.__pactfallGame : game === "deadlane" ? win.__deadlaneGame : win.__rothulkGame;
    return Boolean(win.__deadrotLifecycle && mountedGame && document.querySelector("#scene"));
  }, slug);
}

async function readMetrics(page: Page): Promise<LifecycleMetrics> {
  return page.evaluate(() => {
    return (
      window as unknown as {
        __lifecycleMetrics: () => LifecycleMetrics;
      }
    ).__lifecycleMetrics();
  });
}

async function deadlaneHudPublications(page: Page): Promise<number> {
  return page.evaluate(() => {
    return (
      window as unknown as {
        __deadlaneGame: { snapshot: () => { hudPublications: number } };
      }
    ).__deadlaneGame.snapshot().hudPublications;
  });
}

async function installLifecycleInstrumentation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const listenerIds = new WeakMap<object, number>();
    const targetIds = new WeakMap<EventTarget, number>();
    const activeByType = new Map<string, Set<string>>();
    let nextListenerId = 1;
    let nextTargetId = 1;

    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    const captureOf = (options?: boolean | AddEventListenerOptions): boolean =>
      typeof options === "boolean" ? options : Boolean(options?.capture);
    const listenerId = (listener: EventListenerOrEventListenerObject): number => {
      const key = listener as object;
      const existing = listenerIds.get(key);
      if (existing) return existing;
      const id = nextListenerId++;
      listenerIds.set(key, id);
      return id;
    };
    const targetId = (target: EventTarget): number => {
      const existing = targetIds.get(target);
      if (existing) return existing;
      const id = nextTargetId++;
      targetIds.set(target, id);
      return id;
    };
    const eventKey = (
      target: EventTarget,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): string => `${targetId(target)}:${listenerId(listener)}:${captureOf(options)}`;

    EventTarget.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (listener) {
        const active = activeByType.get(type) ?? new Set<string>();
        active.add(eventKey(this, listener, options));
        activeByType.set(type, active);
      }
      originalAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void {
      if (listener) activeByType.get(type)?.delete(eventKey(this, listener, options));
      originalRemove.call(this, type, listener, options);
    };

    const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const originalCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    const pendingFrames = new Set<number>();
    let frameCallbacks = 0;
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      let id = 0;
      id = originalRequestAnimationFrame((time) => {
        pendingFrames.delete(id);
        frameCallbacks++;
        callback(time);
      });
      pendingFrames.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id: number): void => {
      pendingFrames.delete(id);
      originalCancelAnimationFrame(id);
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const instrumentedCanvases = new WeakSet<HTMLCanvasElement>();
    let webglContextsCreated = 0;
    let webglContextsLost = 0;
    HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: unknown[]) {
      const context = (originalGetContext as (...params: unknown[]) => RenderingContext | null).call(
        this,
        contextId,
        ...args,
      );
      if ((contextId === "webgl" || contextId === "webgl2") && context && !instrumentedCanvases.has(this)) {
        instrumentedCanvases.add(this);
        webglContextsCreated++;
        originalAdd.call(
          this,
          "webglcontextlost",
          () => {
            webglContextsLost++;
          },
          { once: true },
        );
      }
      return context;
    } as typeof HTMLCanvasElement.prototype.getContext;

    let audioContextsCreated = 0;
    let audioContextsClosed = 0;
    const NativeAudioContext = window.AudioContext;
    if (NativeAudioContext) {
      const TrackingAudioContext = new Proxy(NativeAudioContext, {
        construct(target, args) {
          const context = Reflect.construct(target, args) as AudioContext;
          audioContextsCreated++;
          const close = context.close.bind(context);
          context.close = () => {
            audioContextsClosed++;
            return close();
          };
          return context;
        },
      });
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext = TrackingAudioContext;
    }

    (
      window as unknown as {
        __lifecycleMetrics: () => LifecycleMetrics;
      }
    ).__lifecycleMetrics = () => {
      const listeners: Record<string, number> = {};
      for (const [type, active] of activeByType) listeners[type] = active.size;
      return {
        listeners,
        pendingFrames: pendingFrames.size,
        frameCallbacks,
        canvases: document.querySelectorAll("#scene").length,
        webglContextsCreated,
        webglContextsLost,
        liveWebglContexts: webglContextsCreated - webglContextsLost,
        audioContextsCreated,
        audioContextsClosed,
        liveAudioContexts: audioContextsCreated - audioContextsClosed,
      };
    };
  });
}
