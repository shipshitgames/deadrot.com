export class ScourgeSurvivorsAssetUrlCache {
  private readonly promises = new Map<string, Promise<string>>();

  load(
    key: string,
    load: () => Promise<string>,
    mapError: (error: unknown) => Error = (error) => (error instanceof Error ? error : new Error(String(error))),
  ): Promise<string> {
    const cached = this.promises.get(key);
    if (cached) return cached;

    let loading: Promise<string>;
    try {
      loading = load();
    } catch (error) {
      return Promise.reject(mapError(error));
    }

    const pending = loading.catch((error: unknown) => {
      this.promises.delete(key);
      throw mapError(error);
    });
    this.promises.set(key, pending);
    return pending;
  }
}
