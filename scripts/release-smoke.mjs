import {pathToFileURL} from 'node:url';

export function deploymentOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use a plain HTTPS Vercel deployment origin without credentials or a path.');
  }
  return url.origin;
}

export async function checkDeployment({origin, surface, commit, fetchImpl = fetch, now = () => performance.now()}) {
  origin = deploymentOrigin(origin);
  if (!['website', 'driver'].includes(surface) || !/^[a-f0-9]{40}$/i.test(commit || '')) throw new Error('A surface and full expected commit SHA are required.');
  const start = now();
  async function request(path) {
    const response = await fetchImpl(new URL(path, origin), {redirect: 'manual', signal: AbortSignal.timeout(5000), headers: {'Cache-Control': 'no-cache'}});
    if (response.status !== 200) throw new Error(`${surface}: unexpected HTTP ${response.status}`);
    return response;
  }
  const health = await request('/api/health');
  if (!health.headers.get('content-type')?.includes('application/json')) throw new Error(`${surface}: health endpoint is not JSON`);
  const body = await health.json();
  if (body.status !== 'ok' || body.check !== 'liveness' || body.surface !== surface || body.release !== commit.toLowerCase()) throw new Error(`${surface}: health surface or release mismatch`);
  const page = await request(surface === 'website' ? '/website' : '/');
  if (!page.headers.get('content-type')?.includes('text/html')) throw new Error(`${surface}: entry page is not HTML`);
  const html = await page.text();
  const script = html.match(/<script\b[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["'][^>]*>/i)?.[1];
  if (!script) throw new Error(`${surface}: built JavaScript entry is missing`);
  const asset = await request(script);
  if (!/(?:javascript|ecmascript)/i.test(asset.headers.get('content-type') || '') || !(await asset.text()).trim()) throw new Error(`${surface}: JavaScript entry is unavailable`);
  return {surface, release: body.release, check: 'liveness-and-static-entry', durationMs: Math.round(now() - start)};
}

export async function runReleaseSmoke({website, driver, commit, fetchImpl}) {
  // Read-only checks; no credentials, sign-in, customer records, GPS or test writes.
  return Promise.all(['website', 'driver'].map(surface => checkDeployment({origin: surface === 'website' ? website : driver, surface, commit, fetchImpl})));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const results = await runReleaseSmoke({website: process.env.WEBSITE_PREVIEW_URL, driver: process.env.DRIVER_PREVIEW_URL, commit: process.env.EXPECTED_COMMIT});
    console.log(JSON.stringify({passed: true, checks: results}));
  } catch {
    // Do not print response bodies, URLs, tokens, request data or upstream errors.
    console.error('Release smoke failed. Verify the full SHA, both deployment origins, health routes and deployment access.');
    process.exitCode = 1;
  }
}
