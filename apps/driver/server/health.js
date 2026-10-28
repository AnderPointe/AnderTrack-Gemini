// Public liveness only: never query customer data, Auth, storage or external providers here.
export function createHealthHandler(surface, release = () => process.env.VERCEL_GIT_COMMIT_SHA) {
  if (!['website', 'driver'].includes(surface)) throw new Error('Invalid health surface');
  return (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).json({error: 'Method not allowed'});
    }
    const candidate = release();
    const commit = typeof candidate === 'string' && /^[a-f0-9]{40}$/i.test(candidate) ? candidate.toLowerCase() : null;
    res.status(200);
    if (req.method === 'HEAD') return res.end();
    return res.json({status: 'ok', check: 'liveness', surface, release: commit});
  };
}
