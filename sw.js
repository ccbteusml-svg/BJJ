const NOME_DO_CACHE = '4l-academy-v11'; 

const ARQUIVOS_PARA_SALVAR = [
  './',
  './index.html',
  './cadastro.html',
  './painel.html',
  './admin.html',
  './style.css',
  './app.js',
  './cadastro.js',
  './painel-core.js',
  './painel-financeiro.js',
  './painel-perfil.js',
  './admin-lite.js',
  './manifest.json',
  './4L.png',
  './fundo-aluno.png',
  './loading.json',
  './closer.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(NOME_DO_CACHE)
      .then(cache => {
        console.log('[SW] Salvando arquivos no cache local...');
        return Promise.all(
          ARQUIVOS_PARA_SALVAR.map(url => 
            fetch(url, { cache: 'no-cache' }).then(response => {
              if (response.ok) return cache.put(url, response);
              console.warn('[SW] Arquivo não encontrado (ignorado):', url);
            }).catch(err => {
              console.warn('[SW] Falha ao cachear:', url, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(nomesDosCaches => {
      return Promise.all(
        nomesDosCaches.map(cacheAntigo => {
          if (cacheAntigo !== NOME_DO_CACHE) {
            console.log('[SW] Apagando cache antigo:', cacheAntigo);
            return caches.delete(cacheAntigo);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('mercadopago.com') ||
      url.hostname.includes('ui-avatars.com') ||
      url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('sdk.mercadopago.com') ||
      url.hostname.includes('lottiefiles.com') ||
      url.hostname.includes('qrserver.com')) {
      return; 
  }

  const isHTML = req.destination === 'document';
  const isAsset = ['style', 'script', 'image', 'font'].includes(req.destination);

  if (isHTML) {
    event.respondWith(
      fetch(req).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          caches.open(NOME_DO_CACHE).then(cache => cache.put(req, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(req, { ignoreSearch: true });
      })
    );
  } else if (isAsset) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(cachedResponse => {
        const fetchPromise = fetch(req).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            caches.open(NOME_DO_CACHE).then(cache => cache.put(req, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
  }
});
