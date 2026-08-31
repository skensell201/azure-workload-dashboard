/** Runs `worker` over `items` with at most `concurrency` in flight. Results keep input order. */
export async function runBatched<T, R>(items: T[], worker: (item: T) => Promise<R>, concurrency = 6): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function lane(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  const lanes = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: lanes }, lane));
  return results;
}
