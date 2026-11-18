import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
export function configureApp(app: INestApplication) {
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
    }),
  );
  const origins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: false });
  const requests = new Map<string, { count: number; until: number }>();
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    if (!req.path.toLowerCase().startsWith('/user/')) return next();
    const now = Date.now();
    // Bound memory and expire inactive IPs without a timer that keeps tests alive.
    for (const [key, entry] of requests)
      if (entry.until <= now) requests.delete(key);
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const entry = requests.get(key) || { count: 0, until: now + 60_000 };
    if (requests.size >= 10000 && !requests.has(key))
      return res.status(429).json({ message: 'Please retry shortly' });
    requests.set(key, entry);
    if (++entry.count > 20) {
      res.setHeader('Retry-After', Math.ceil((entry.until - now) / 1000));
      return res
        .status(429)
        .json({ message: 'Too many requests; please retry shortly' });
    }
    next();
  });
}
