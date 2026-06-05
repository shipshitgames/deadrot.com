// Input layer for the mouse-flight survivors. Tracks the cursor as NDC the Game
// unprojects to a world aim-point; WASD/arrows are a unit fallback axis that
// overrides the cursor; plus edge-triggered confirm + 1/2/3 draft-card picks.
export class InputSystem {
  // Latest cursor position in NDC [-1, 1]; held at the last in-bounds value when
  // the pointer leaves the canvas so the ship never bolts to a corner.
  ndcX = 0
  ndcY = 0
  pointerInside = false

  private up = false
  private down = false
  private left = false
  private right = false

  private confirmQueued = false
  private cardQueued = -1 // 1/2/3 -> 0/1/2, or -1

  constructor(private readonly canvas: HTMLCanvasElement) {}

  bind() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseout', this.onMouseOut)
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseout', this.onMouseOut)
  }

  /** Unit keyboard steering vector; length 0 when no key is held. */
  keyAxis(): { x: number; y: number } {
    const x = (this.right ? 1 : 0) - (this.left ? 1 : 0)
    const y = (this.up ? 1 : 0) - (this.down ? 1 : 0)
    if (x === 0 && y === 0) return { x: 0, y: 0 }
    const len = Math.hypot(x, y)
    return { x: x / len, y: y / len }
  }

  consumeConfirm(): boolean {
    if (this.confirmQueued) {
      this.confirmQueued = false
      return true
    }
    return false
  }

  /** Consumes a queued 1/2/3 card pick (0-based), or -1 if none. */
  consumeCard(): number {
    const c = this.cardQueued
    this.cardQueued = -1
    return c
  }

  private onMouseMove = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect()
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1)
    this.pointerInside = nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1
    if (this.pointerInside) {
      this.ndcX = nx
      this.ndcY = ny
    }
  }

  private onMouseOut = () => {
    this.pointerInside = false
  }

  private onKeyDown = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.up = true
        break
      case 'ArrowDown':
      case 'KeyS':
        this.down = true
        break
      case 'ArrowLeft':
      case 'KeyA':
        this.left = true
        break
      case 'ArrowRight':
      case 'KeyD':
        this.right = true
        break
      case 'Digit1':
        this.cardQueued = 0
        break
      case 'Digit2':
        this.cardQueued = 1
        break
      case 'Digit3':
        this.cardQueued = 2
        break
      case 'Enter':
        this.confirmQueued = true
        break
      case 'Space':
        this.confirmQueued = true
        e.preventDefault()
        break
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.up = false
        break
      case 'ArrowDown':
      case 'KeyS':
        this.down = false
        break
      case 'ArrowLeft':
      case 'KeyA':
        this.left = false
        break
      case 'ArrowRight':
      case 'KeyD':
        this.right = false
        break
    }
  }
}
