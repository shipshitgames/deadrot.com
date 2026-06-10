import { createSnapshotStore } from "@deadrot/game-kit/core";

export interface BannerSnapshot {
  visible: boolean;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionMeta: string;
  gold: string;
  wave: string;
  hp: string;
  tower: string;
  build: string;
  run: string;
  hint: string;
}

const store = createSnapshotStore<BannerSnapshot>({
  visible: false,
  title: "DEADLANE",
  subtitle: "",
  actionLabel: "Deploy",
  actionMeta: "Start wave",
  gold: "0",
  wave: "0 / 0",
  hp: "0",
  tower: "EMBER TURRET (50)",
  build: "100%",
  run: "100%",
  hint: "CLICK A CELL TO BUILD (COST 50)",
});

export function getBannerSnapshot(): BannerSnapshot {
  return store.get();
}

export function subscribeBanner(listener: (snapshot: BannerSnapshot) => void): () => void {
  return store.subscribe(() => listener(store.get()));
}

export function setBannerSnapshot(next: BannerSnapshot): void {
  store.set(next);
}

export function patchBannerSnapshot(next: Partial<BannerSnapshot>): void {
  store.patch(next);
}
