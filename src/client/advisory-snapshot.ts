/** A read started before a write (or a newer read) cannot restore old choices. */
export function advisorySnapshot<T>(read: () => Promise<T>, apply: (value: T) => void, stale: () => void) {
  let generation = 0;
  let disposed = false;
  return {
    invalidate() { generation++; if (!disposed) stale(); },
    dispose() { disposed = true; generation++; },
    async refresh() {
      const current = ++generation;
      if (!disposed) stale();
      try {
        const value = await read();
        if (disposed || current !== generation) return;
        apply(value);
      } catch (error) {
        if (!disposed && current === generation) throw error;
      }
    },
  };
}
