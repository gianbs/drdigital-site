// Service worker: deixa o app abrir mesmo sem internet.
// Estratégia: tenta a rede primeiro (para sempre pegar a versão nova) e cai no cache se estiver offline.
const CACHE = 'caixa-drdigital-v4';
const BASE = [
  './', 'index.html', 'config.js', 'css/app.css', 'manifest.webmanifest',
  'assets/logo.svg', 'assets/logo-white.svg', 'assets/icon.svg', 'assets/icone-180.png', 'assets/icone-192.png',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/calc.js', 'js/ops.js', 'js/ui.js', 'js/icons.js', 'js/charts.js', 'js/forms.js',
  'js/sync.js', 'js/demo.js', 'js/xlsx.js', 'js/exportar.js',
  'js/views/comum.js', 'js/views/resumo.js', 'js/views/lancamentos.js', 'js/views/contas.js', 'js/views/vendas.js',
  'js/views/clientes.js', 'js/views/fixos.js', 'js/views/relatorios.js', 'js/views/ajustes.js', 'js/views/mais.js',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // a nuvem não passa pelo cache
  ev.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
