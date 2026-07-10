import { describe, expect, test } from "bun:test";
import { AudioSystem, type BrawlAudioBackend } from "../../src/game/audio/AudioSystem";

class FakeBackend implements BrawlAudioBackend {
  contextState = "running" as const;
  disposed = 0;
  calls: string[] = [];
  setMusicLevel(_level: number): void {}
  setSfxLevel(_level: number): void {}
  setMusicMuted(_muted: boolean): void {}
  unlock(): void {
    this.calls.push("unlock");
  }
  sfx(name: string): void {
    this.calls.push(name);
  }
  dispose(): void {
    this.disposed += 1;
  }
}

describe("Brawl AudioSystem", () => {
  test("maps combat events to semantic shared-engine cues", () => {
    const backend = new FakeBackend();
    const audio = new AudioSystem(backend);
    audio.unlock();
    audio.roundStart("duel");
    audio.jump();
    audio.impact(false, 13);
    audio.impact(true, 3);
    audio.roundEnd("victory");
    expect(backend.calls).toEqual(["unlock", "bell", "jump", "impact", "guard", "victory"]);
  });

  test("dispose tears down the backend once", () => {
    const backend = new FakeBackend();
    const audio = new AudioSystem(backend);
    audio.dispose();
    audio.dispose();
    expect(backend.disposed).toBe(1);
  });
});
