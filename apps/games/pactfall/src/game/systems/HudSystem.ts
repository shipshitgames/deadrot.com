import { CONSTANTS } from "../constants";
import type { Game } from "../Game";
import { ABILITY_KEYS, type AbilityKey } from "./abilities";

interface AbilitySlot {
  root: HTMLElement;
  cd: HTMLElement;
}

// HUD adapter. React renders the shell; this system reads game state each frame
// and writes into cached element refs so the game loop stays independent.
export class HudSystem {
  private readonly elBaseFriendly: HTMLElement;
  private readonly elBaseEnemy: HTMLElement;
  private readonly elHp: HTMLElement;
  private readonly elMana: HTMLElement;
  private readonly elManaValue: HTMLElement;
  private readonly abilitySlots: Record<AbilityKey, AbilitySlot>;
  private readonly buff: HTMLElement;
  private readonly buffTime: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerTitle: HTMLElement;
  private readonly titleScreen: HTMLElement;

  constructor(root: HTMLElement) {
    this.elBaseFriendly = this.req(root, "#meter-base-friendly .bar i");
    this.elBaseEnemy = this.req(root, "#meter-base-enemy .bar i");
    this.elHp = this.req(root, "#meter-hp .bar i");
    this.elMana = this.req(root, "#meter-mana .bar i");
    this.elManaValue = this.req(root, "#meter-mana .mana-value");
    this.abilitySlots = {
      q: this.abilitySlot(root, "q"),
      w: this.abilitySlot(root, "w"),
      e: this.abilitySlot(root, "e"),
    };
    this.buff = this.req(root, "#buff");
    this.buffTime = this.req(root, "#buff .buff-time");
    this.banner = this.req(root, "#banner");
    this.bannerTitle = this.req(root, "#banner .banner-title");
    this.titleScreen = this.req(root, "#title-screen");

    // Static canon label — the arena district these duels are sanctioned in.
    const arenaName = root.querySelector("#arena-name");
    if (arenaName) arenaName.textContent = CONSTANTS.arena.name;
    // Ability names come from the data, like every other tunable.
    for (const key of ABILITY_KEYS) {
      const name = root.querySelector(`#ability-${key} .ability-name`);
      if (name) name.textContent = CONSTANTS.abilities[key].name;
    }
  }

  private abilitySlot(root: HTMLElement, key: AbilityKey): AbilitySlot {
    return {
      root: this.req(root, `#ability-${key}`),
      cd: this.req(root, `#ability-${key} .ability-cd`),
    };
  }

  private req(root: HTMLElement, sel: string): HTMLElement {
    const el = root.querySelector(sel);
    if (!el) throw new Error(`PACTFALL HUD: missing element ${sel}`);
    return el as HTMLElement;
  }

  update(game: Game): void {
    const ent = game.entities;

    this.setBar(this.elHp, ent.champion.hp, CONSTANTS.champion.maxHp);
    this.setBar(this.elMana, ent.champion.mana, Math.max(1, ent.champion.maxMana));
    this.elManaValue.textContent = `${Math.round(ent.champion.mana)}`;
    this.setBar(this.elBaseFriendly, ent.friendlyBase.hp, CONSTANTS.base.maxHp);
    this.setBar(this.elBaseEnemy, ent.enemyBase.hp, CONSTANTS.base.maxHp);

    for (const key of ABILITY_KEYS) {
      const slot = this.abilitySlots[key];
      const cd = game.abilities.player.cooldowns[key];
      const cooling = cd > 0;
      const oom = !cooling && ent.champion.mana < CONSTANTS.abilities[key].manaCost;
      slot.cd.textContent = cooling ? `${cd.toFixed(1)}` : oom ? "MANA" : "RDY";
      slot.root.classList.toggle("ability--cooling", cooling);
      slot.root.classList.toggle("ability--oom", oom);
    }

    if (game.buffed) {
      this.buff.classList.remove("buff--off");
      this.buff.classList.add("buff--on");
      this.buffTime.textContent = `${game.buffTime.toFixed(1)}s`;
    } else {
      this.buff.classList.add("buff--off");
      this.buff.classList.remove("buff--on");
      this.buffTime.textContent = "—";
    }

    this.titleScreen.classList.toggle("banner--hidden", game.phase !== "title");

    if (game.phase === "won") this.setBanner("VICTORY - WARDEN BASE FALLS");
    else if (game.phase === "lost") this.setBanner("DEFEAT - THE PYRE IS EXTINGUISHED");
  }

  private setBar(fill: HTMLElement, hp: number, max: number): void {
    const pct = Math.max(0, Math.min(1, hp / max)) * 100;
    fill.style.width = `${pct}%`;
  }

  setBanner(title: string | null): void {
    if (!title) {
      this.banner.classList.add("banner--hidden");
      return;
    }
    this.bannerTitle.textContent = title;
    this.banner.classList.remove("banner--hidden");
  }
}
