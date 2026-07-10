import type { AudioSystem } from "./audio/AudioSystem";
import type { FighterSystem } from "./fighters/FighterSystem";
import type { InputSystem } from "./input/InputSystem";
import type { RenderSystem } from "./render/RenderSystem";

/** Explicit ownership registry; construction and per-frame order stay in Game. */
export interface GameSystems {
  render: RenderSystem;
  fighters: FighterSystem;
  input: InputSystem;
  audio: AudioSystem;
}
