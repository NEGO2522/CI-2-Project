// Simple Service Worker that does nothing
self.addEventListener('install', event => {
  // Skip waiting to activate the new service worker immediately
  self.skipWaiting();
  console.log('Service Worker installed');
});

self.addEventListener('activate', event => {
  // Take control of all pages under this service worker's scope
  event.waitUntil(clients.claim());
  console.log('Service Worker activated');
});

self.addEventListener('fetch', event => {
  // Let the browser handle the request normally
  return;
});
