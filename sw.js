const CACHE='nulliverse-timeweb-v1-8-13';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))
    )
  );
  self.clients.claim();
});

function fetchWithTimeout(request,timeoutMs=1800){
  return Promise.race([
    fetch(request),
    new Promise((_,reject)=>
      setTimeout(()=>reject(new Error('network timeout')),timeoutMs)
    )
  ]);
}

async function networkFirstNavigation(request){
  try{
    const response=await fetchWithTimeout(request,1800);

    if(response&&response.ok){
      const cache=await caches.open(CACHE);

      // Keep both the exact navigation URL and index.html fresh.
      cache.put(request,response.clone()).catch(()=>{});
      cache.put('./index.html',response.clone()).catch(()=>{});

      return response;
    }

    throw new Error('network response not ok');
  }catch(_){
    return (
      await caches.match(request)
      || await caches.match('./index.html')
      || await caches.match('./')
      || Response.error()
    );
  }
}

async function cacheFirstStatic(request){
  const cached=await caches.match(request);
  if(cached)return cached;

  try{
    const response=await fetch(request);
    if(response&&response.ok){
      const cache=await caches.open(CACHE);
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  }catch(_){
    return Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;

  if(request.method!=='GET')return;

  // HTML/navigation should discover new versions quickly.
  if(request.mode==='navigate'){
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Static assets remain fast and offline-friendly.
  event.respondWith(cacheFirstStatic(request));
});
