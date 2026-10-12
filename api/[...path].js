import { createApiMiddleware } from '../server/apiMiddleware.js';

const handler = createApiMiddleware();

export default function(req, res) {
  return handler(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });
}
