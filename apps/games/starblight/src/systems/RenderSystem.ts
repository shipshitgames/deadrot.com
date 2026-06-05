import * as THREE from 'three'
import { COLORS, CONSTANTS, WORLD } from '../game/constants'

// Owns the renderer, scene, orthographic FOLLOW-camera, parallax starfield, the
// containment-lattice world border, and screen-shake. The camera frames a fixed
// CONSTANTS.camera.viewHeight slice of the large WORLD and chases the ship; shake
// is composed as an additive offset on top of the follow target.
export class RenderSystem {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.OrthographicCamera
  readonly renderer: THREE.WebGLRenderer

  // Follow state.
  readonly camFocus = new THREE.Vector2(0, 0)
  private halfW = WORLD.halfW
  private halfH = WORLD.halfH
  private shake = 0

  private nearStars!: THREE.Points
  private farStars!: THREE.Points
  private lattice: THREE.LineSegments[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(COLORS.void)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400)
    this.camera.position.set(0, 0, CONSTANTS.camera.z)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    this.buildStars()
    this.buildLattice()
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  dispose() {
    window.removeEventListener('resize', this.resize)
    for (const layer of [this.nearStars, this.farStars]) {
      this.scene.remove(layer)
      layer.geometry.dispose()
      ;(layer.material as THREE.Material).dispose()
    }
    for (const l of this.lattice) {
      this.scene.remove(l)
      l.geometry.dispose()
      ;(l.material as THREE.Material).dispose()
    }
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  /** Current frustum half-extents (change with aspect on resize). */
  get viewHalfW(): number {
    return this.halfW
  }
  get viewHalfH(): number {
    return this.halfH
  }
  /** Half the diagonal of the visible window — used to spawn enemies offscreen. */
  get viewHalfDiag(): number {
    return Math.hypot(this.halfW, this.halfH)
  }

  /** Unproject a cursor NDC point onto the z=0 plane (exact for an ortho cam). */
  screenToWorld(ndcX: number, ndcY: number): { x: number; y: number } {
    return { x: this.camFocus.x + ndcX * this.halfW, y: this.camFocus.y + ndcY * this.halfH }
  }

  /** Adds a screen-shake impulse (larger = harder kick). */
  addShake(amount: number) {
    this.shake = Math.min(this.shake + amount, CONSTANTS.fx.shakeMax)
  }

  resetFocus(x: number, y: number) {
    this.camFocus.set(x, y)
  }

  /** Eases the camera toward the ship (deadzone box) and applies shake. */
  update(dt: number, shipX: number, shipY: number) {
    const c = CONSTANTS.camera
    const dzW = c.deadzoneW / 2
    const dzH = c.deadzoneH / 2

    // Target focus keeps the ship pinned just inside the deadzone box.
    let tx = this.camFocus.x
    let ty = this.camFocus.y
    if (shipX > this.camFocus.x + dzW) tx = shipX - dzW
    else if (shipX < this.camFocus.x - dzW) tx = shipX + dzW
    if (shipY > this.camFocus.y + dzH) ty = shipY - dzH
    else if (shipY < this.camFocus.y - dzH) ty = shipY + dzH

    const k = 1 - Math.exp(-c.followSmooth * dt)
    this.camFocus.x += (tx - this.camFocus.x) * k
    this.camFocus.y += (ty - this.camFocus.y) * k

    // Shake is an additive pan on top of the follow target (no rotation).
    let sx = 0
    let sy = 0
    if (this.shake > 0.0001) {
      sx = (Math.random() - 0.5) * this.shake
      sy = (Math.random() - 0.5) * this.shake
      this.shake = Math.max(0, this.shake - CONSTANTS.fx.shakeDecay * dt * this.shake)
    }
    const fx = this.camFocus.x + sx
    const fy = this.camFocus.y + sy
    this.camera.position.set(fx, fy, c.z)
    this.camera.lookAt(fx, fy, 0)

    // Parallax: star layers trail the camera at (1 - parallax), so flying any
    // direction streaks them past you. No per-point JS loop.
    const s = CONSTANTS.stars
    this.farStars.position.set(this.camFocus.x * (1 - s.farParallax), this.camFocus.y * (1 - s.farParallax), -30)
    this.nearStars.position.set(this.camFocus.x * (1 - s.nearParallax), this.camFocus.y * (1 - s.nearParallax), -12)
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  add(obj: THREE.Object3D) {
    this.scene.add(obj)
  }
  remove(obj: THREE.Object3D) {
    this.scene.remove(obj)
  }

  private buildStars() {
    const s = CONSTANTS.stars
    this.farStars = this.makeStarLayer(s.farCount, s.farSize, COLORS.ash, 0.5)
    this.nearStars = this.makeStarLayer(s.nearCount, s.nearSize, COLORS.bone, 0.32)
    this.scene.add(this.farStars)
    this.scene.add(this.nearStars)
  }

  private makeStarLayer(count: number, size: number, color: number, opacity: number): THREE.Points {
    const field = CONSTANTS.stars.fieldSize
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * field
      positions[i * 3 + 1] = (Math.random() - 0.5) * field
      positions[i * 3 + 2] = 0
    }
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity,
    })
    return new THREE.Points(geom, mat)
  }

  // The quarantine perimeter: Warden/Pyre containment chrome at the world border.
  private buildLattice() {
    const hw = WORLD.halfW
    const hh = WORLD.halfH
    const pts: number[] = []
    const push = (x1: number, y1: number, x2: number, y2: number) =>
      pts.push(x1, y1, -2, x2, y2, -2)
    // Border box.
    push(-hw, -hh, hw, -hh)
    push(hw, -hh, hw, hh)
    push(hw, hh, -hw, hh)
    push(-hw, hh, -hw, -hh)
    // Sparse interior lattice lines for a "containment grid" read.
    const step = 25
    for (let x = -hw + step; x < hw; x += step) push(x, -hh, x, hh)
    for (let y = -hh + step; y < hh; y += step) push(-hw, y, hw, y)
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const mat = new THREE.LineBasicMaterial({ color: COLORS.gunmetal, transparent: true, opacity: 0.16 })
    const grid = new THREE.LineSegments(geom, mat)
    this.scene.add(grid)
    this.lattice.push(grid)

    // Brighter border emphasis (drawn over the faint interior grid).
    const border: number[] = []
    const pb = (x1: number, y1: number, x2: number, y2: number) =>
      border.push(x1, y1, -1.8, x2, y2, -1.8)
    pb(-hw, -hh, hw, -hh)
    pb(hw, -hh, hw, hh)
    pb(hw, hh, -hw, hh)
    pb(-hw, hh, -hw, -hh)
    const bgeom = new THREE.BufferGeometry()
    bgeom.setAttribute('position', new THREE.Float32BufferAttribute(border, 3))
    const bmat = new THREE.LineBasicMaterial({ color: COLORS.blood, transparent: true, opacity: 0.42 })
    const borderLines = new THREE.LineSegments(bgeom, bmat)
    this.scene.add(borderLines)
    this.lattice.push(borderLines)
  }

  private resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h)

    // Frame a fixed viewHeight slice; width derives from aspect. Gameplay coords
    // stay viewport-independent at any aspect ratio.
    this.halfH = CONSTANTS.camera.viewHeight / 2
    this.halfW = this.halfH * (w / h)
    this.camera.left = -this.halfW
    this.camera.right = this.halfW
    this.camera.top = this.halfH
    this.camera.bottom = -this.halfH
    this.camera.updateProjectionMatrix()
  }
}
