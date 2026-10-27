// ---- src/proxy-config.js ----
// Base URL of the family's one Cloudflare Worker (JayPengX/Shared-Proxy's
// worker.js) behind the AI photo import (/gemini) and the AI schedule edits
// (/nl-edit); each caller below appends its own path. It's public (every
// visitor's browser calls it), so it's here, not a setting: VITE_PROXY_URL
// overrides it only for a fork or a test. (Sync is the Orbit Pass's,
// through the shared kit: src/sync.js.)
//
// `?.` guards against import.meta.env itself being undefined (unbuilt source
// served directly, bypassing Vite) - see gemini-ocr.js's matching note.
import * as kit from '#kit/orbit.mjs';

// (api.<domain> on the family's own domain: the kit's API, kit/domain.mjs.)
const PROXY_DEFAULT = kit.API || 'https://orbit-workers-proxy.pengzjay.workers.dev';
const PROXY_BASE_URL = (import.meta.env?.VITE_PROXY_URL ?? PROXY_DEFAULT).trim().replace(/\/+$/, '');

export function proxyPath(path) {
  return PROXY_BASE_URL ? `${PROXY_BASE_URL}${path}` : '';
}
