export function exponentialBackoff(attempt: number, baseDelay = 1000, maxDelay = 300000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  return delay * (0.75 + Math.random() * 0.5)
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 10,
  baseDelay = 1000,
  maxDelay = 300000,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try { return await fn() }
    catch (err) {
      if (attempt === maxAttempts - 1) throw err
      await new Promise(r => setTimeout(r, exponentialBackoff(attempt, baseDelay, maxDelay)))
    }
  }
  throw new Error('max retries exceeded')
}
