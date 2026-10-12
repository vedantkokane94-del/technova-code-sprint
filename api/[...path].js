import { createApiMiddleware } from '../server/apiMiddleware.js';

const handler = createApiMiddleware();

export default function(req, res) {
  // Restore original request URL if rewritten by Vercel
  const forwardedUrl = req.headers['x-forwarded-url'] || req.headers['x-vercel-forwarded-url'] || req.url;
  if (forwardedUrl && forwardedUrl.startsWith('/api')) {
    req.url = forwardedUrl;
  }

  return handler(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });
}
