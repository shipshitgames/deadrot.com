/** Generic swap-remove sweep: compacts `arr` in place, releasing dead items. */
export function sweep<T>(arr: T[], isDead: (item: T) => boolean, release?: (item: T) => void): void {
  let n = arr.length;
  for (let i = 0; i < n; i++) {
    if (isDead(arr[i])) {
      release?.(arr[i]);
      arr[i] = arr[n - 1];
      n--;
      i--;
    }
  }
  arr.length = n;
}
