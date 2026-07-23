/** Spatial-lite rolloff: full gain near the ship, never fully silent off-screen. */
export function spatialGain(distance: number): number {
  const near = 7;
  const far = 52;
  if (distance <= near) return 1;
  if (distance >= far) return 0.22;
  return 1 - ((distance - near) / (far - near)) * 0.78;
}
