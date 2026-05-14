/* ============================================================
   DHB Field Registration System — Service Worker
   ============================================================ */

var CACHE_NAME = 'dhb-cache-v1';
var ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/form.html',
  '/digitizer.html',
  '/submissions.html',
  '/admin.html',
  '/print.html',
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/app.js',
  '/assets/js/auth.js',
  '/assets/js/api.js',
  '/assets/js/map.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME }).map(function(k){ return caches.delete(k) })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(response){
        if(!response || response.status !== 200 || response.type !== 'basic') return response;
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, clone) });
        return response;
      }).catch(function(){
        /* Offline fallback for page navigations */
        if(e.request.mode === 'navigate'){
          return caches.match('/index.html');
        }
      });
    })
  );
});

/* Background sync for submissions when offline */
self.addEventListener('sync', function(e){
  if(e.tag === 'sync-submissions'){
    e.waitUntil(syncPendingSubmissions());
  }
});

function syncPendingSubmissions(){
  return self.indexedDB.open('dhb-offline', 1).then(function(db){
    var tx = db.transaction('pending', 'readonly');
    var store = tx.objectStore('pending');
    return store.getAll();
  }).then(function(items){
    return Promise.all(items.map(function(item){
      return fetch(APP.config.API_URL, {
        method: 'POST',
        body: item.data
      });
    }));
  });
}
