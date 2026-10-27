// Orbit Class: the family's one service worker (Orbit-Core/kit/sw.js),
// with this app's settings. It keeps the page's own files so the app opens
// without a connection and can be installed, and never keeps a file that
// isn't the one its address names (GitHub's CDN can answer a new address
// with the old file for a while after a deploy).
// Vite's files (assets/) carry their hash in their name: from the cache first.
self.ORBIT_SW = {
  cache: 'orbit-cache-v2',
  prefix: 'orbit-cache-',
  title: 'Orbit Class',
  route: (request, url) => (request.mode !== 'navigate' && url.pathname.includes('/assets/') ? 'cacheFirst' : null)
};
importScripts('../Orbit-Core/kit/sw.js');
