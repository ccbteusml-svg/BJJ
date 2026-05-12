const NOME_DO_CACHE = '4l-academy-v8'; 

const ARQUIVOS_PARA_SALVAR = [
  './',
  './index.html',
  './cadastro.html',
  './painel.html',
  './admin.html',
  './style.css',
  './app.js',
  './cadastro.js',
  './painel.js',
  './admin.js',
  './manifest.json',
  './4L.png',
  './fundo-aluno.png'
];

// 1. INSTALAÇÃO: O navegador baixa e salva os arquivos da lista acima
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(NOME_DO_CACHE)
      .then(cache => {
        console.log('[Service Worker] Salvando arquivos no cache local...');
        return cache.addAll(ARQUIVOS_PARA_SALVAR);
      })
      .then(() => self.skipWaiting()) // Força a instalação imediata
  );
});

// 2. ATIVAÇÃO (A FAXINA): Limpa os caches antigos se você mudou o "NOME_DO_CACHE"
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
    }).then(() => self.clients.claim()) // Assume o controle da tela imediatamente
  );
});

// 3. INTERCEPTAÇÃO: Tenta pegar da rede, se estiver sem internet, pega do cache
self.addEventListener('fetch', event => {
  // Ignora requisições para o Supabase, ImgBB, Mercado Pago (não podemos fazer cache de banco de dados/API)
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('mercadopago.com') ||
      event.request.url.includes('imgbb.com') || 
      event.request.url.includes('ui-avatars.com')) {
      return; 
  }

  event.respondWith(
  caches.match(event.request).then(cachedResponse => {
    // Dispara a busca na rede em segundo plano para atualizar o cache
    const fetchPromise = fetch(event.request).then(networkResponse => {
      caches.open(NOME_DO_CACHE).then(cache => {
        cache.put(event.request, networkResponse.clone());
      });
      return networkResponse;
    }).catch(() => {
        // Ignora erros de rede aqui, pois o cache já vai salvar o usuário
    });
    
    // O pulo do gato: Retorna o cache IMEDIATAMENTE se existir. 
    // Se for o primeiro acesso e não tiver cache, ele aguarda a rede.
    return cachedResponse || fetchPromise;
  })
);
});
