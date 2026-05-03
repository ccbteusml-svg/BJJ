// Mude este número (v2, v3, etc.) sempre que você fizer uma atualização grande no código!
// Isso força o celular dos alunos a baixar a versão mais nova.
const NOME_DO_CACHE = '4l-academy-v3'; 

const ARQUIVOS_PARA_SALVAR = [
  '/',
  '/index.html',
  '/cadastro.html',
  '/painel.html',
  '/admin.html',
  '/style.css',
  '/app.js',
  '/cadastro.js',
  '/painel.js',
  '/admin.js',
  '/manifest.json',
  '/4L.png',
  '/fundo-aluno.png'
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
    fetch(event.request)
      .catch(() => {
        // Se a internet falhar (fetch deu erro), ele busca o arquivo salvo no cache
        return caches.match(event.request);
      })
  );
});
