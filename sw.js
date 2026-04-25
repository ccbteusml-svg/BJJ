const NOME_DO_CACHE = 'osscontrol-v1';
const ARQUIVOS_PARA_SALVAR = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js'
];

// O navegador baixa e salva os arquivos no cache do celular
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(NOME_DO_CACHE)
      .then(cache => {
        return cache.addAll(ARQUIVOS_PARA_SALVAR);
      })
  );
});

// Se o usuário ficar sem internet, o app carrega os arquivos salvos
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
