export interface BannerSnapshot {
  visible: boolean;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionMeta: string;
  gold: string;
  wave: string;
  hp: string;
  build: string;
  run: string;
  hint: string;
}

let snapshot: BannerSnapshot = {
  visible: false,
  title: "DEADLANE",
  subtitle: "",
  actionLabel: "Deploy",
  actionMeta: "Start wave",
  gold: "0",
  wave: "0 / 0",
  hp: "0",
  build: "100%",
  run: "100%",
  hint: "CLICK A CELL TO BUILD (COST 50)",
};

const listeners = new Set<(snapshot: BannerSnapshot) => void>();

export function getBannerSnapshot(): BannerSnapshot {
  return snapshot;
}

export function subscribeBanner(listener: (snapshot: BannerSnapshot) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setBannerSnapshot(next: BannerSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener(snapshot);
}

export function patchBannerSnapshot(next: Partial<BannerSnapshot>): void {
  setBannerSnapshot({ ...snapshot, ...next });
}
