'use strict';
const V = '20261121185552-b7da4a';
const APP = 'app/';
const BASE = new URL('./', self.location.href).href;
const RUTA_BASE = new URL(BASE).pathname;
const CB = 'b-' + V;
const MEM_MAX = 96 * 1024 * 1024, MEM_ARCHIVO = 12 * 1024 * 1024;
let K = null, M = null, abriendo = null, memBytes = 0;
const MEM = new Map();
const TE = new TextEncoder(), TD = new TextDecoder();
self.addEventListener('install', (e) => { e.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', (e) => {
e.waitUntil((async () => {
for (const n of await caches.keys()) if (n !== CB) await caches.delete(n);
await self.clients.claim();
for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage({ t: 'v', v: V });
})());
});
self.addEventListener('message', (e) => {
const d = e.data || {}, p = e.ports && e.ports[0];
const responder = (x) => { try { p && p.postMessage(x); } catch (_) {  } };
if (d.t === 'v?') responder({ v: V, abierto: !!M });
else if (d.t === 'k') e.waitUntil(abrir(d.k, d.v).then(() => responder({ ok: true }), (err) => responder({ ok: false, e: String((err && err.message) || err) })));
else if (d.t === 'salir') e.waitUntil(cerrar().then(() => responder({ ok: true })));
});
async function abrir(raw, v) {
if (v !== V) throw new Error('version');
const clave = await crypto.subtle.importKey('raw', raw instanceof ArrayBuffer ? raw : new Uint8Array(raw), 'AES-GCM', false, ['decrypt']);
const r = await fetch(BASE + 'c.json', { cache: 'no-store' });
if (!r.ok) throw new Error('config');
const C = await r.json();
if (C.v !== V) throw new Error('version');
const m = JSON.parse(TD.decode(await descifrar(clave, C.m[0], C.m[1], 1)));
if (!m || m.v !== V || !m.f) throw new Error('indice');
K = clave; M = m;
}
async function cerrar() {
K = null; M = null; MEM.clear(); memBytes = 0;
for (const n of await caches.keys()) await caches.delete(n);
}
async function bloque(nombre) {
const url = BASE + 'd/' + nombre + '.bin';
let c = null;
try { c = await caches.open(CB); } catch (_) { c = null; }
let r = c ? await c.match(url) : null;
if (!r) {
r = await fetch(url, { cache: 'no-cache' });
if (!r.ok) throw new Error('bloque ' + r.status);
if (c) { try { await c.put(url, r.clone()); } catch (_) {  } }
}
return new Uint8Array(await r.arrayBuffer());
}
async function descifrar(clave, nombre, n, z) {
const b = await bloque(nombre);
const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12), additionalData: TE.encode(nombre) }, clave, b.subarray(12)));
let out = pt.subarray(0, n);
if (z) out = new Uint8Array(await new Response(new Blob([out]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
return out;
}
function preguntar(cliente, msg, ms) {
return new Promise((ok) => {
const ch = new MessageChannel();
const t = setTimeout(() => ok(null), ms);
ch.port1.onmessage = (e) => { clearTimeout(t); ok(e.data); };
try { cliente.postMessage(msg, [ch.port2]); } catch (_) { clearTimeout(t); ok(null); }
});
}
function b64d(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function pedirClave(e) {
if (M) return Promise.resolve();
if (abriendo) return abriendo;
abriendo = (async () => {
const lista = [];
if (e.clientId) { const c = await self.clients.get(e.clientId); if (c && c.type === 'window') lista.push(c); }
for (const c of await self.clients.matchAll({ type: 'window' })) if (c.url.startsWith(BASE + APP) && !lista.includes(c)) lista.push(c);
for (const c of lista) {
const r = await preguntar(c, { t: 'k?' }, 1500);
if (r && r.v === V && typeof r.k === 'string') { try { await abrir(b64d(r.k), r.v); return; } catch (_) {  } }
}
})().finally(() => { abriendo = null; });
return abriendo;
}
function recordar(ruta, datos) {
if (datos.length > MEM_ARCHIVO) return;
MEM.set(ruta, datos); memBytes += datos.length;
for (const [k, v] of MEM) { if (memBytes <= MEM_MAX) break; MEM.delete(k); memBytes -= v.length; }
}
function inyectar(datos) {
const src = BASE + APP + '__p.js';
const html = TD.decode(datos);
const etiqueta = '<script src="' + src + '"></script>';
const m = /<head[^>]*>/i.exec(html);
const out = m ? html.slice(0, m.index + m[0].length) + etiqueta + html.slice(m.index + m[0].length) : etiqueta + html;
return TE.encode(out);
}
const noEncontrado = () => new Response('No encontrado', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
async function servir(e, u) {
const req = e.request;
let rel;
try { rel = decodeURIComponent(u.pathname.slice(RUTA_BASE.length + APP.length)); } catch (_) { return noEncontrado(); }
if (rel.includes('\0') || rel.split('/').includes('..')) return noEncontrado();
const original = rel;
if (rel === '' || rel.endsWith('/')) rel += 'index.html';
if (!M) await pedirClave(e);
if (!M) {
if (req.mode === 'navigate') return Response.redirect(BASE + '?volver=' + encodeURIComponent(APP + original + u.search), 302);
return new Response('', { status: 401, headers: { 'Cache-Control': 'no-store' } });
}
const cab = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
if (rel === '__p.js') return new Response(M.p, { headers: { ...cab, 'Content-Type': 'text/javascript; charset=utf-8' } });
let f = M.f[rel];
if (!f && M.f[rel + '/index.html'] && req.mode === 'navigate') return Response.redirect(u.origin + u.pathname + '/' + u.search, 301);
if (!f) return noEncontrado();
const [nombre, tipo, n, z] = f;
let datos = MEM.get(rel);
if (!datos) {
try { datos = await descifrar(K, nombre, n, z); } catch (_) { return new Response('No se ha podido abrir el archivo', { status: 503, headers: { ...cab, 'Content-Type': 'text/plain; charset=utf-8' } }); }
recordar(rel, datos);
}
if (tipo.startsWith('text/html')) datos = inyectar(datos);
cab['Content-Type'] = tipo;
cab['Accept-Ranges'] = 'bytes';
const total = datos.length;
const rango = req.headers.get('range');
const m = rango && /^bytes=(\d*)-(\d*)$/.exec(rango.trim());
if (m && (m[1] || m[2])) {
let a, b;
if (m[1]) { a = +m[1]; b = m[2] ? Math.min(+m[2], total - 1) : total - 1; } else { a = Math.max(0, total - +m[2]); b = total - 1; }
if (a > b || a >= total) return new Response('', { status: 416, headers: { ...cab, 'Content-Range': 'bytes */' + total } });
const parte = datos.slice(a, b + 1);
return new Response(req.method === 'HEAD' ? null : parte, { status: 206, headers: { ...cab, 'Content-Range': 'bytes ' + a + '-' + b + '/' + total, 'Content-Length': String(parte.length) } });
}
cab['Content-Length'] = String(total);
return new Response(req.method === 'HEAD' ? null : datos, { status: 200, headers: cab });
}
self.addEventListener('fetch', (e) => {
const u = new URL(e.request.url);
if (u.origin !== self.location.origin || !u.href.startsWith(BASE + APP)) return;
if (e.request.method !== 'GET' && e.request.method !== 'HEAD') return;
e.respondWith(servir(e, u));
});
