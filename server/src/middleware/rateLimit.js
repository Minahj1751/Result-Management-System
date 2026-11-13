/**
 * Simple in-memory rate limiter for sensitive endpoints (e.g. login).
 * No external dependency required.
 */
const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 30 } = {}) => {
  const hits = new Map();

  // Periodically clean expired entries
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits) {
      if (now - record.start > windowMs) hits.delete(key);
    }
  }, windowMs);
  cleanup.unref?.();

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = hits.get(key);

    if (!record || now - record.start > windowMs) {
      record = { start: now, count: 0 };
      hits.set(key, record);
    }

    record.count += 1;

    if (record.count > max) {
      const retryAfter = Math.ceil((record.start + windowMs - now) / 1000);
      res.set('Retry-After', retryAfter);
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }

    next();
  };
};

module.exports = createRateLimiter;
