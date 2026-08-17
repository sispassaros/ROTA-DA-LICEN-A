[Uploading manifest.json…]()
<img width="180" height="180" alt="apple-touch-icon" src="https://github.com/user-attachments/assets/6761f99e-eee8-49de-b982-299a25eb7571" />
<img width="512" height="512" alt="icon-512-maskable" src="https://github.com/user-attachments/assets/2350c197-79f1-4944-af53-b4048dd2bb18" />
<img width="512" height="512" alt="icon-512" src="https://github.com/user-attachments/assets/9ca34840-1387-4d2a-a045-fb54f849e20b" />
<img width="192" height="192" alt="icon-192" src="https://github.com/user-attachments/assets/31ceab58-9aff-43ef-b545-35fb0b8f0af4" />
{
  "name": "Rota da Licença — SisPássaro",
  "short_name": "Rota da Licença",
  "description": "Acompanhamento do processo de licenciamento de criador amador de pássaro silvestre",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#1e293b",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
[sw.js](https://github.com/user-attachments/files/31125812/sw.js)
const CACHE_NAME = "rota-da-licenca-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

// Estratégia simples: tenta buscar na rede, e só usa o cache como reserva
// (garante que o app sempre carregue algo, mesmo com internet instável)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
