export class RateLimiter {
    private cache: Map<string, number[]>;
    private limit: number;
    private windowMs: number;

    constructor(limit: number, windowMs: number) {
        this.cache = new Map();
        this.limit = limit;
        this.windowMs = windowMs;
    }

    /**
     * Check if a key has exceeded the rate limit.
     * Returns true if allowed, false if rate limited.
     */
    public check(key: string): boolean {
        const now = Date.now();
        const timestamps = this.cache.get(key) || [];

        // Filter timestamps within the current window
        const validTimestamps = timestamps.filter(ts => ts > now - this.windowMs);

        if (validTimestamps.length >= this.limit) {
            this.cache.set(key, validTimestamps);
            return false; // Rate limited
        }

        validTimestamps.push(now);
        this.cache.set(key, validTimestamps);
        return true; // Allowed
    }
}
