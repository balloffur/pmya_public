const CACHE_NAME = 'cyph-cache-v1.1';

// Список файлов для оффлайн-работы
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './main.js',
  '../theme.css',
  '../theme.js',
  'https://cdn.jsdelivr.net/npm/libsodium-sumo@0.7.13',
  'https://cdn.jsdelivr.net/npm/libsodium-wrappers-sumo@0.7.13'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Удаляем старые кэши, если обновилась версия CACHE_NAME
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Перехватываем только GET-запросы к ресурсам
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем из кэша, если нашли
        if (response) {
          return response;
        }
        // Иначе запрашиваем из сети (без сохранения в кэш)
        return fetch(event.request);
      })
  );
});
