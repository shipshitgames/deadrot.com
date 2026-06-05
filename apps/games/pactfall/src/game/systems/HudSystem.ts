import { CONSTANTS } from '../constants';
import type { Game } from '../Game';

// HUD adapter. React renders the shell; this system reads game state each frame
// and writes into cached element refs so the game loop stays independent.
export class HudSystem {
  private readonly elBaseFriendly: HTMLElement;
  private readonly elBaseEnemy: HTMLElement;
  private readonly elHp: HTMLElement;
  private readonly buff: HTMLElement;
  private readonly buffTime: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerTitle: HTMLElement;

  constructor(root: HTMLElement) {
    this.elBaseFriendly = this.req(root, '#meter-base-friendly .bar i');
    this.elBaseEnemy = this.req(root, '#meter-base-enemy .bar i');
    this.elHp = this.req(root, '#meter-hp .bar i');
    this.buff = this.req(root, '#buff');
    this.buffTime = this.req(root, '#buff .buff-time');
    this.banner = this.req(root, '#banner');
    this.bannerTitle = this.req(root, '#banner .banner-title');

    // Static canon label — the arena district these duels are sanctioned in.
    const arenaName = root.querySelector('#arena-name');
    if (arenaName) arenaName.textContent = CONSTANTS.arena.name;
  }

  private req(root: HTMLElement, sel: string): HTMLElement {
    const el = root.querySelector(sel);
    if (!el) throw new Error(`PACTFALL HUD: missing element ${sel}`);
    return el as HTMLElement;
  }

  update(game: Game): void {
    const ent = game.entities;

    this.setBar(this.elHp, ent.champion.hp, CONSTANTS.champion.maxHp);
    this.setBar(this.elBaseFriendly, ent.friendlyBase.hp, CONSTANTS.base.maxHp);
    this.setBar(this.elBaseEnemy, ent.enemyBase.hp, CONSTANTS.base.maxHp);

    if (game.buffed) {
      this.buff.classList.remove('buff--off');
      this.buff.classList.add('buff--on');
      this.buffTime.textContent = `${game.buffTime.toFixed(1)}s`;
    } else {
      this.buff.classList.add('buff--off');
      this.buff.classList.remove('buff--on');
      this.buffTime.textContent = '—';
    }

    if (game.phase === 'won') this.setBanner('VICTORY — WARDEN BASE FALLS');
    else if (game.phase === 'lost') this.setBanner('DEFEAT — THE PYRE IS EXTINGUISHED');
  }

  private setBar(fill: HTMLElement, hp: number, max: number): void {
    const pct = Math.max(0, Math.min(1, hp / max)) * 100;
    fill.style.width = `${pct}%`;
  }

  setBanner(title: string | null): void {
    if (!title) {
      this.banner.classList.add('banner--hidden');
      return;
    }
    this.bannerTitle.textContent = title;
    this.banner.classList.remove('banner--hidden');
  }
}
