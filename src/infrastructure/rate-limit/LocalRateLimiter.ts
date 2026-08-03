import { RateLimiter } from '@/domain/interfaces';

// In-memory fallback rate limiter.
// For production, this should be replaced by an UpstashRateLimiter implementation.
const memoryStore = new Map<string, { count: number, resetAt: number }>();

export class LocalRateLimiter implements RateLimiter {
  async checkLimit(identifier: string, limit: number, windowSeconds: number): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const now = Date.now();
    const resetTime = now + (windowSeconds * 1000);
    
    const record = memoryStore.get(identifier);
    
    if (!record || record.resetAt < now) {
      memoryStore.set(identifier, { count: 1, resetAt: resetTime });
      return { success: true, limit, remaining: limit - 1, reset: resetTime };
    }
    
    if (record.count >= limit) {
      return { success: false, limit, remaining: 0, reset: record.resetAt };
    }
    
    record.count += 1;
    memoryStore.set(identifier, record);
    
    return { success: true, limit, remaining: limit - record.count, reset: record.resetAt };
  }
}
