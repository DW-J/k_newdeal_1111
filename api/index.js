import { handleRequest } from '../server.js';

export default function handler(req, res) {
  const route = typeof req.query?.route === 'string' ? req.query.route : '';
  if (!['translate', 'speech', 'save-translation', 'suno-link', 'usage'].includes(route)) {
    res.statusCode = 404;
    return res.end();
  }
  req.url = `/api/${route}`;
  return handleRequest(req, res);
}
