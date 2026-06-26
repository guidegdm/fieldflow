export function exponentialBackoff(attempt: number, baseDelay = 1000, maxDelay = 300000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  return delay + Math.random() * 1000
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, maxAttempts = 9): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try { return await fn() }
    catch (err) {
      if (attempt === maxAttempts - 1) throw err
      await new Promise(r => setTimeout(r, exponentialBackoff(attempt)))
    }
  }
  throw new Error('max retries exceeded')
}
