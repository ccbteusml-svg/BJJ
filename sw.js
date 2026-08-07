const NOME_DO_CACHE = '4l-academy-v10'; 

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
  './admin-core.js',
  './admin-alunos.js',
  './admin-financeiro.js',
  './manifest.json',
  './4L.png',
  './fundo-aluno.png',
  './loading.json',
  './closer.json'
];

// 1. INSTALAÇÃO: Salva os arquivos um por um (não falha se um estiver faltando)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(NOME_DO_CACHE)
      .then(cache => {
        console.log('[Service Worker] Salvando arquivos no cache local...');
        return Promise.all(
          ARQUIVOS_PARA_SALVAR.map(url => 
            fetch(url).then(response => {
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

// 2. ATIVAÇÃO: Limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(nomesDosCaches => {
      return Promise.all(
        nomesDosCaches.map(cacheAntigo => {
          if (cacheAntigo !== NOME_DO_CACHE) {
            console.log('[Service Worker] Apagando cache antigo:', cacheAntigo);
            return caches.delete(cacheAntigo);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH: Cache primeiro, rede em segundo plano. Nunca retorna undefined.
self.addEventListener('fetch', event => {
  // Ignora requisições externas
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('mercadopago.com') ||
      event.request.url.includes('ui-avatars.com') ||
      event.request.url.includes('cdn.jsdelivr.net') ||
      event.request.url.includes('unpkg.com') ||
      event.request.url.includes('sdk.mercadopago.com') ||
      event.request.url.includes('lottiefiles.com') ||
      event.request.url.includes('qrserver.com')) {
      return; 
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          caches.open(NOME_DO_CACHE).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {
        // Se a rede falhar, retorna o cache (se existir)
        return cachedResponse;
      });

      // Retorna cache imediatamente se existir, senão aguarda a rede
      return cachedResponse || fetchPromise;
    })
  );
});