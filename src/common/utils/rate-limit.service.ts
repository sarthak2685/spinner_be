import { Injectable } from '@nestjs/common';

interface Bucket { count: number; expires: number }

@Injectable()
export class RateLimitService {
  private buckets = new Map<string, Bucket>();
  private blocks = new Map<string, number>();

  isBlocked(ip: string, now = Date.now()): boolean {
    const until = this.blocks.get(ip);
    if (!until) return false;
    if (until < now) {
      this.blocks.delete(ip);
      return false;
    }
    return true;
  }

  check(ip: string, action: string, max: number, minutes: number, now = Date.now()): boolean {
    if (this.isBlocked(ip, now)) return true;
    const key = `RL_${action}_${ip}`;
    const existing = this.buckets.get(key);
    const count = existing && existing.expires > now ? existing.count : 0;
    if (count >= max) {
      this.blocks.set(ip, now + 15 * 60 * 1000);
      return true;
    }
    this.buckets.set(key, {
      count: count + 1,
      expires: existing && existing.expires > now ? existing.expires : now + minutes * 60 * 1000,
    });
    return false;
  }
}
