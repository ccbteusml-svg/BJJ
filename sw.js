// ⚠️ REGRA DE DEPLOY: suba este número (v27 → v28 → ...) a CADA deploy.
// É ele que apaga o cache antigo e força o celular a baixar o JS/HTML novo.
// Se esquecer de subir, os alunos continuam rodando a versão velha do app.
const SW_VERSION = 'v32';
const NOME_DO_CACHE = '4l-academy-' + SW_VERSION;

const ARQUIVOS_PARA_SALVAR = [
  './',
  './index.html',
  './cadastro.html',
  './painel.html',
  './admin.html',
  './style.css',
  './supabase-config.js',
  './app.js',
  './cadastro.js',
  './painel-core.js',
  './painel-financeiro.js',
  './painel-perfil.js',
  './painel-ajustes.js',
  './rede-guarda.js',
  './admin-lite.js',
  './4L.png',
  './fundo-aluno.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(NOME_DO_CACHE)
      .then(cache => {
        console.log(`[SW ${SW_VERSION}] Instalando cache novo...`);
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
            console.log(`[SW ${SW_VERSION}] 🗑️ Apagando cache antigo:`, cacheAntigo);
            return caches.delete(cacheAntigo);
          }
        })
      );
    }).then(() => {
      console.log(`[SW ${SW_VERSION}] ✅ Ativado e limpo!`);
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

// ============================================================
// PUSH NOTIFICATIONS (v32)
// Recebe o push do servidor mesmo com o app fechado e mostra
// a notificacao na barra do celular. Ao tocar, abre o painel.
// ============================================================
self.addEventListener('push', event => {
  let dados = {
    titulo: '4L Academy',
    corpo: 'Voce tem uma nova notificacao.',
    url: './painel.html'
  };
  try {
    if (event.data) {
      const recebido = event.data.json();
      dados = { ...dados, ...recebido };
    }
  } catch (e) {
    console.warn('[SW] Push sem JSON valido, usando padrao.', e);
  }

  event.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: './icone-192.png',
      badge: './icone-192.png',
      tag: '4l-academy-cobranca',
      renotify: true,
      data: { url: dados.url }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlAlvo = (event.notification.data && event.notification.data.url) || './painel.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(janelas => {
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate(urlAlvo);
          return janela.focus();
        }
      }
      return clients.openWindow(urlAlvo);
    })
  );
});
