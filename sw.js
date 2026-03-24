const CACHE_NAME = 'sidimas-cache-v2';

self.addEventListener('install', (event) => {
  // Langsung update jika ada versi sw.js baru tanpa harus ditutup aplikasinya
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Hapus cache versi lama agar tidak menumpuk
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Hanya proses permintaan GET (Script HTML, CSS, JS, Gambar). 
  // Abaikan POST (pengiriman data ke Database Apps Script) agar data surat tidak saling tabrakan.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Jika internet hidup, update cache secara otomatis di background
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Jika HP sedang offline/tidak ada sinyal, ambil dari cache
        // ignoreSearch: true memastikan parameter ?id=... diabaikan saat mencari kecocokan file HTML
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
