const buckets = new Map();
export function createRateLimiter({ windowMs, max }) {
    return (req, res, next) => {
        const now = Date.now();
        const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.baseUrl}`;
        const current = buckets.get(key);
        if (!current || current.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (current.count >= max) {
            const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }
        current.count += 1;
        next();
    };
}
