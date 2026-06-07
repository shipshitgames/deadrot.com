// The system registry. Each system receives (GameContext, GameSystems) and
// calls its siblings through `this.sys.<name>`. Type-only imports keep this a
// pure compile-time contract (no runtime import cycle).

import type { FxSystem } from "./entities/FxSystem";
import type { PickupsSystem } from "./entities/PickupsSystem";
import type { PlayerSystem } from "./entities/PlayerSystem";
import type { ProjectilesSystem } from "./entities/ProjectilesSystem";
import type { WeaponSystem } from "./entities/WeaponSystem";
import type { GameOverSystem } from "./modes/GameOverSystem";
import type { MissionSystem } from "./modes/MissionSystem";
import type { MultiplayerSystem } from "./modes/MultiplayerSystem";
import type { PveDirectorSystem } from "./modes/PveDirectorSystem";
import type { SurvivorsSystem } from "./modes/SurvivorsSystem";
import type { ArenaSystem } from "./render/ArenaSystem";
import type { RenderSystem } from "./render/RenderSystem";
import type { HudSystem } from "./systems/HudSystem";
import type { InputSystem } from "./systems/InputSystem";

export interface GameSystems {
  render: RenderSystem;
  arena: ArenaSystem;
  player: PlayerSystem;
  weapon: WeaponSystem;
  projectiles: ProjectilesSystem;
  pickups: PickupsSystem;
  fx: FxSystem;
  pve: PveDirectorSystem;
  mission: MissionSystem;
  survivors: SurvivorsSystem;
  multiplayer: MultiplayerSystem;
  input: InputSystem;
  hud: HudSystem;
  gameOver: GameOverSystem;
}
