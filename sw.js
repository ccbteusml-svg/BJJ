const NOME_DO_CACHE = '4l-academy-v10'; // 🔥 Versão nova = cache novo

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
  './4L.png',
  './fundo-aluno.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(NOME_DO_CACHE)
      .then(cache => {
        console.log('[SW v99] Instalando cache novo...');
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
            console.log('[SW v99] 🗑️ Apagando cache antigo:', cacheAntigo);
            return caches.delete(cacheAntigo);
          }
        })
      );
    }).then(() => {
      console.log('[SW v99] ✅ Ativado e limpo!');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Nunca cacheia chamadas de API
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('mercadopago.com') ||
      url.hostname.includes('ui-avatars.com') ||
      url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('sdk.mercadopago.com')) {
      return; 
  }

  const isHTML = req.destination === 'document';
  const isAsset = ['style', 'script', 'image', 'font'].includes(req.destination);

  // Estratégia: Network First para HTML, Cache First para assets
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
