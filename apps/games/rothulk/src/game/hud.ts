import { CONSTANTS } from '../constants';
import type { GameMode } from './types';

// Thin adapter over the React-rendered HUD shell. The game loop writes into
// cached element refs instead of coupling gameplay state to React.
export class Hud {
  private lives = document.getElementById('hud-lives')!;
  private hp = document.getElementById('hud-hp')!;
  private obj = document.getElementById('hud-obj')!;
  private progress = document.getElementById('hud-progress')!;
  private embers = document.getElementById('hud-embers')!;
  private toast = document.getElementById('toast')!;

  private toastTimer = 0;

  setLives(n: number) {
    this.lives.textContent = `x${Math.max(0, n)}`;
  }

  setHp(hp: number) {
    const pct = Math.max(0, hp) / CONSTANTS.MAX_HP;
    this.hp.style.transform = `scaleX(${pct})`;
  }

  setEmbers(n: number) {
    this.embers.textContent = String(n);
  }

  setProgress(frac: number) {
    const pct = Math.min(1, Math.max(0, frac));
    this.progress.style.transform = `scaleX(${pct})`;
  }

  setObjective(text: string) {
    this.obj.textContent = text;
  }

  flashToast(text: string, ttl = 1.6) {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    this.toastTimer = ttl;
  }

  showBigToast(mode: GameMode) {
    if (mode === 'won') {
      this.toast.innerHTML =
        '<span class="big win">CORE IGNITED</span><span class="small">THE HULK BURNS &mdash; PRESS R TO RUN IT AGAIN</span>';
    } else if (mode === 'gameover') {
      this.toast.innerHTML =
        '<span class="big dead">CONSUMED</span><span class="small">THE SCOURGE TAKES YOU &mdash; PRESS R TO RETRY</span>';
    }
    this.toast.classList.add('show', 'persist');
  }

  clearBigToast() {
    this.toast.classList.remove('persist');
    this.toast.classList.remove('show');
    this.toast.textContent = '';
  }

  update(dt: number) {
    if (this.toast.classList.contains('persist')) return;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    }
  }
}
