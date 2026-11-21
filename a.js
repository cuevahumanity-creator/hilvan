(() => {
'use strict';
const $ = (s) => document.querySelector(s);
const body = document.body;
const APP = 'app/';
const K_SES = 'ak', K_VISTO = 'tv';
const almacen = (() => { try { const s = window.sessionStorage; s.setItem('_', '1'); s.removeItem('_'); return s; } catch (_) { return null; } })();
const QUIETO = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const b64e = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const visto = () => { try { return almacen && almacen.getItem(K_VISTO) === '1'; } catch (_) { return false; } };
const marcarVisto = () => { try { almacen && almacen.setItem(K_VISTO, '1'); } catch (_) {  } };
const haySW = () => 'serviceWorker' in navigator && window.isSecureContext && !!(window.crypto && crypto.subtle) && typeof DecompressionStream === 'function';
const MSG_SIN_SW = 'Este navegador no puede abrir esta web: necesita «service workers», que no funcionan en ventanas privadas de Firefox ni en navegadores antiguos. Ábrela en una ventana normal de Chrome, Edge, Firefox o Safari actualizados.';
let C = null, regP = null, X = null, orient = 'h', ocupado = false, sonido = null, enTrailer = false, tIntro = 0, rafT = 0;
const vid = $('#vid'), vsi = $('#vsi'), vno = $('#vno'), poster = $('#poster'), velo = $('#velo');
const inp = $('#clave'), err = $('#error'), bEntrar = $('#b-entrar'), campo = $('.campo'), barra = $('#barra');
function leerSesion() { try { const j = JSON.parse((almacen && almacen.getItem(K_SES)) || 'null'); return j && typeof j.v === 'string' && typeof j.k === 'string' ? j : null; } catch (_) { return null; } }
function guardarSesion(v, k) { try { almacen && almacen.setItem(K_SES, JSON.stringify({ v, k: b64e(k) })); } catch (_) {  } }
function borrarSesion() { try { almacen && almacen.removeItem(K_SES); } catch (_) {  } }
function destino() {
const q = new URLSearchParams(location.search).get('volver');
if (q && q.startsWith(APP) && !q.includes('..') && !q.includes('//') && !q.includes('\\') && !/[\0-\x1f]/.test(q)) return q + location.hash;
return APP + location.hash;
}
const ir = () => location.replace(new URL(destino(), location.href).href);
const error = (t, info) => { err.textContent = t || ''; err.classList.toggle('info', !!info); inp.setAttribute('aria-invalid', t && !info ? 'true' : 'false'); };
const texto = (t) => { bEntrar.querySelector('span').textContent = t; };
const progreso = (p) => { if (p == null) { barra.classList.remove('on'); barra.style.setProperty('--p', '0'); return; } barra.classList.add('on'); barra.style.setProperty('--p', clamp(p, 0, 1).toFixed(3)); };
function aviso(t) { const a = $('#aviso'); a.textContent = t; a.hidden = !t; }
function mensaje(w, msg, ms) {
return new Promise((ok, ko) => {
const ch = new MessageChannel();
const t = setTimeout(() => ko(new Error('sin respuesta')), ms || 20000);
ch.port1.onmessage = (e) => { clearTimeout(t); ok(e.data); };
w.postMessage(msg, [ch.port2]);
});
}
function activo(r) {
return new Promise((ok, ko) => {
const t = setTimeout(() => (r.active ? ok(r.active) : ko(new Error('sw'))), 15000);
const fin = (w) => { clearTimeout(t); ok(w); };
const seguir = () => {
const w = r.installing || r.waiting;
if (!w) { if (r.active) fin(r.active); return; }
if (w.state === 'activated') return fin(w);
w.addEventListener('statechange', () => { if (w.state === 'activated') fin(w); else if (w.state === 'redundant') seguir(); });
};
if (r.installing || r.waiting) seguir();
else if (r.active) fin(r.active);
else r.addEventListener('updatefound', seguir, { once: true });
});
}
async function trabajador() {
const r = await regP;
for (let i = 0; i < 4; i++) {
const w = await activo(r);
try { const x = await mensaje(w, { t: 'v?' }, 4000); if (x && x.v === C.v) return w; } catch (_) {  }
try { await r.update(); } catch (_) {  }
}
throw new Error('version');
}
async function abrir(k) {
const w = await trabajador();
const r = await mensaje(w, { t: 'k', v: C.v, k: k.slice(0) });
if (!r || !r.ok) throw new Error((r && r.e) || 'sw');
}
async function derivar(clave) {
const pw = new TextEncoder().encode(clave.normalize('NFC'));
const base = await crypto.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveBits']);
const sal = b64d(C.s);
const prm = (i) => ({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: i });
const n0 = 20000, t0 = performance.now();
await crypto.subtle.deriveBits(prm(n0), base, 256);
const est = Math.max(250, ((performance.now() - t0) * C.i) / n0);
const ini = performance.now(); let vivo = true;
const anim = () => { if (!vivo) return; progreso(0.06 + 0.84 * (1 - Math.exp((-1.7 * (performance.now() - ini)) / est))); requestAnimationFrame(anim); };
anim();
try { return new Uint8Array(await crypto.subtle.deriveBits(prm(C.i), base, 512)); } finally { vivo = false; }
}
async function comprobar(bits) { return b64e(new Uint8Array(await crypto.subtle.digest('SHA-256', bits.slice(32)))) === C.h; }
function tipos() {
const v = document.createElement('video');
const w = v.canPlayType('video/webm; codecs="vp9"'), m = v.canPlayType('video/mp4; codecs="avc1.42E028"');
return { webm: w, mp4: m };
}
const TIPOS = tipos();
function fuente(o) { if (!o) return ''; if (TIPOS.webm === 'probably' && o.webm) return o.webm; if (TIPOS.mp4 && o.mp4) return o.mp4; if (TIPOS.webm && o.webm) return o.webm; return ''; }
function encajar() {
const a = innerWidth / Math.max(1, innerHeight);
const o = a < 1 ? 'v' : 'h';
document.documentElement.style.setProperty('--fit', a >= 1.5 || a < 0.6 ? 'cover' : 'contain');
if (!C || !C.x) return;
const cambia = o !== orient || !poster.src;
orient = C.x[o] ? o : C.x.h ? 'h' : 'v';
X = C.x[orient] || null;
if (!X || !cambia) return;
if (X.jpg) { poster.src = X.jpg; poster.hidden = false; }
if (!enTrailer) { const s1 = fuente(X.si), s2 = fuente(X.no); if (s1 && !vsi.src.endsWith(s1)) vsi.src = s1; if (s2 && !vno.src.endsWith(s2)) vno.src = s2; vsi.classList.remove('on'); vno.classList.remove('on'); }
}
function reaccion(tipo) {
if (QUIETO || !X) return;
const el = tipo === 'si' ? vsi : vno, otro = tipo === 'si' ? vno : vsi;
if (!el.src) return;
try { el.currentTime = 0; } catch (_) {  }
el.play().then(() => { el.classList.add('on'); otro.classList.remove('on'); otro.pause(); }).catch(() => {});
}
class Sonido {
constructor() {
const A = window.AudioContext || window.webkitAudioContext; const c = (this.c = new A());
this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(this.master); this.bus = comp;
this.filtro = c.createBiquadFilter(); this.filtro.type = 'lowpass'; this.filtro.frequency.value = 220; this.filtro.Q.value = 0.8;
this.gDron = c.createGain(); this.gDron.gain.value = 0; this.filtro.connect(this.gDron); this.gDron.connect(this.bus);
[55, 55.35, 82.4].forEach((f, i) => { const o = c.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.connect(this.filtro); o.start(); });
this.gPad = c.createGain(); this.gPad.gain.value = 0; this.gPad.connect(this.bus);
[220, 329.6, 440, 554.4].forEach((f) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = c.createGain(); g.gain.value = 0.18; o.connect(g); g.connect(this.gPad); o.start(); });
this.ruido = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = this.ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
this.on = false; this.hechos = new Set(); this.tPunt = 0; this.tPieza = 0;
}
activar(on) { this.on = on; const t = this.c.currentTime; if (on && this.c.resume) this.c.resume(); this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(on ? 0.7 : 0, t, on ? 0.25 : 0.08); }
golpe(f0, dur, vol) { if (!this.on) return; const c = this.c, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(34, t + dur * 0.6); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.05); this.soplo(0.25, 900, 0.18); }
soplo(dur, f, vol, sube) { if (!this.on) return; const c = this.c, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.ruido; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(sube ? f * 0.3 : f, t); bp.frequency.exponentialRampToValueAtTime(sube ? f : f * 0.25, t + dur); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(bp); bp.connect(g); g.connect(this.bus); s.start(t); s.stop(t + dur + 0.05); }
nota(f, dur, vol, tipo) { if (!this.on) return; const c = this.c, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = tipo || 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.05); }
evento(k, fn) { if (this.hechos.has(k)) return; this.hechos.add(k); fn(); }
reiniciar() { this.hechos.clear(); }
paso(t, final) {
if (!this.on) return; const a = this.c.currentTime;
this.gDron.gain.setTargetAtTime(final ? 0.05 : 0.12 + 0.1 * sstep(6, 14, t) - 0.12 * sstep(25, 27.5, t), a, 0.3);
this.filtro.frequency.setTargetAtTime(final ? 260 : 220 + 1400 * sstep(3, 16, t), a, 0.4);
this.gPad.gain.setTargetAtTime(final ? 0.02 : 0.09 * sstep(4, 12, t) + 0.12 * sstep(23, 25, t) - 0.18 * sstep(26.5, 28, t), a, 0.5);
if (final) return;
if (t > 1 && t < 6.3 && t - this.tPunt > 0.11) { this.tPunt = t; this.soplo(0.07, 5200, 0.05); }
if (t > 6.2) this.evento('m', () => this.golpe(90, 1.2, 0.6));
if (t > 6.4 && t < 17.2 && t - this.tPieza > 0.28 + Math.random() * 0.25) { this.tPieza = t; this.golpe(70 + Math.random() * 25, 0.32, 0.22); }
if (t > 3.4) this.evento('r1', () => this.golpe(120, 1.4, 0.7));
if (t > 8.4) this.evento('r2', () => this.golpe(110, 1.2, 0.6));
if (t > 13.1) this.evento('r3', () => { this.golpe(120, 1.4, 0.7); this.soplo(1.2, 2400, 0.12, true); });
if (t > 22.2) this.evento('h', () => { this.nota(660, 0.25, 0.12); setTimeout(() => this.nota(880, 0.4, 0.12), 140); });
if (t > 23.8) this.evento('f', () => { this.golpe(80, 2.2, 0.8); [220, 277.2, 329.6, 440].forEach((f) => this.nota(f, 3.2, 0.06, 'sine')); });
}
}
const DUR_INTRO = 6.5;
function tiempo() { return X && !vid.hidden ? vid.currentTime || 0 : (performance.now() - tIntro) / 1000; }
function duracion() { return X && !vid.hidden ? vid.duration || 30 : DUR_INTRO; }
function bucle() {
cancelAnimationFrame(rafT);
const paso = () => {
if (!enTrailer) { if (sonido) sonido.paso(0, true); return; }
const t = tiempo();
$('#b-saltar .progreso b').style.setProperty('--p', clamp(t / duracion(), 0, 1).toFixed(3));
if (sonido) sonido.paso(t, false);
if (!X && t >= DUR_INTRO) { terminar(false); return; }
rafT = requestAnimationFrame(paso);
};
rafT = requestAnimationFrame(paso);
}
function reproducir() {
const acceso = $('#acceso'); acceso.classList.remove('on'); setTimeout(() => { if (enTrailer) acceso.hidden = true; }, 500);
enTrailer = true; body.classList.add('en-trailer'); if (sonido) sonido.reiniciar();
vsi.classList.remove('on'); vno.classList.remove('on');
const s = X && fuente(X);
velo.style.transition = 'none'; velo.style.opacity = '1';
if (!s) {
body.classList.add('sin-video'); const tr = $('#trama'); tr.style.display = 'none'; void tr.offsetWidth; tr.style.display = '';
tIntro = performance.now(); requestAnimationFrame(() => { velo.style.transition = 'opacity 1.4s ease'; velo.style.opacity = '0'; }); bucle(); return;
}
vid.hidden = false; if (!vid.src.endsWith(s)) vid.src = s;
try { vid.currentTime = 0; } catch (_) {  }
const espera = setTimeout(() => { if (enTrailer && vid.readyState < 3) terminar(true); }, 9000);
vid.play().then(() => { clearTimeout(espera); velo.style.transition = 'opacity 1.2s ease'; velo.style.opacity = '0'; bucle(); }).catch(() => { clearTimeout(espera); terminar(true); });
}
function terminar(saltado) {
if (!enTrailer) return; enTrailer = false; marcarVisto();
body.classList.remove('en-trailer');
if (saltado && X) { vid.pause(); vid.hidden = true; }
velo.style.transition = 'opacity .6s ease'; velo.style.opacity = '0';
mostrarFormulario();
if (X) { const s1 = fuente(X.si), s2 = fuente(X.no); if (s1 && !vsi.src.endsWith(s1)) { vsi.preload = 'auto'; vsi.src = s1; } if (s2 && !vno.src.endsWith(s2)) { vno.preload = 'auto'; vno.src = s2; } }
}
function final() {
enTrailer = false; body.classList.remove('en-trailer');
if (!X) body.classList.add('sin-video'); else vid.hidden = true;
velo.style.transition = 'opacity .8s ease'; velo.style.opacity = '0';
if (X) { vsi.preload = 'auto'; vno.preload = 'auto'; encajar(); }
mostrarFormulario();
}
function mostrarFormulario() {
const acceso = $('#acceso'); if (!acceso.hidden && acceso.classList.contains('on')) return;
acceso.hidden = false; acceso.classList.remove('saliendo');
requestAnimationFrame(() => requestAnimationFrame(() => acceso.classList.add('on')));
setTimeout(() => { try { if (matchMedia('(pointer: fine)').matches && !inp.disabled) inp.focus({ preventScroll: true }); } catch (_) {  } }, 450);
}
function grano() {
try {
const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'); const im = g.createImageData(160, 160);
for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
g.putImageData(im, 0, 0); $('.grano').style.backgroundImage = 'url(' + c.toDataURL() + ')';
} catch (_) {  }
}
function enlazar() {
$('#b-ver').onclick = () => { const ver = inp.type === 'password'; inp.type = ver ? 'text' : 'password'; const b = $('#b-ver'); b.setAttribute('aria-pressed', String(ver)); b.setAttribute('aria-label', ver ? 'Ocultar la clave' : 'Mostrar la clave'); b.title = b.getAttribute('aria-label'); inp.focus(); };
inp.addEventListener('input', () => { if (err.textContent && !ocupado) error(''); });
$('#b-saltar').onclick = () => terminar(true);
addEventListener('keydown', (e) => { if (!enTrailer) return; if (e.key === 'Escape' || (e.key === ' ' && (!e.target || e.target.tagName !== 'INPUT'))) { e.preventDefault(); terminar(true); } });
$('#b-sonido').onclick = () => {
const b = $('#b-sonido'); const on = b.getAttribute('aria-pressed') !== 'true';
try { if (!sonido) sonido = new Sonido(); sonido.activar(on); b.setAttribute('aria-pressed', String(on)); b.querySelector('span').textContent = on ? 'Sonido sí' : 'Sonido'; } catch (_) {  }
};
$('#b-trailer').onclick = () => { if (!QUIETO) reproducir(); };
vid.addEventListener('ended', () => terminar(false));
addEventListener('resize', encajar);
$('#f-acceso').addEventListener('submit', async (e) => {
e.preventDefault(); if (ocupado) return;
const clave = inp.value;
if (!clave) { error('Escribe la clave para entrar.'); inp.focus(); return; }
if (!haySW() || !regP) { error(MSG_SIN_SW); return; }
if (!C) { error('No se ha podido cargar la página. Comprueba la conexión y recarga.'); return; }
ocupado = true; bEntrar.disabled = true; texto('Comprobando…'); error('Comprobando la clave en tu navegador…', true); progreso(0.03);
let bits = null;
try { bits = await derivar(clave); } catch (_) { bits = null; }
if (!bits) { ocupado = false; bEntrar.disabled = false; texto('Entrar'); progreso(null); error('Este navegador no ha podido comprobar la clave. Prueba con otro navegador actualizado.'); return; }
if (!(await comprobar(bits))) {
bits.fill(0); progreso(null); await new Promise((r) => setTimeout(r, 350));
ocupado = false; bEntrar.disabled = false; texto('Entrar');
error('Esa no es la clave. Revisa mayúsculas y minúsculas y vuelve a probar.'); reaccion('no'); if (sonido) sonido.nota(196, 0.3, 0.12, 'square');
campo.classList.remove('sacude'); void campo.offsetWidth; campo.classList.add('sacude'); inp.select(); return;
}
const k = bits.slice(0, 32); bits.fill(0);
texto('Abriendo…'); error('Abriendo la web…', true); progreso(0.94);
try { await abrir(k); } catch (x) {
ocupado = false; bEntrar.disabled = false; texto('Entrar'); progreso(null);
error(x && x.message === 'version' ? 'Se acaba de publicar una versión nueva. Recarga la página y vuelve a escribir la clave.' : 'No se ha podido abrir la web en este navegador. Recarga la página y vuelve a probar.'); return;
}
guardarSesion(C.v, k); k.fill(0); marcarVisto(); inp.value = ''; progreso(1); error('');
bEntrar.classList.add('ok'); texto('Dentro'); reaccion('si');
if (sonido) { sonido.nota(523.3, 0.18, 0.12); setTimeout(() => sonido && sonido.nota(784, 0.45, 0.12), 120); }
setTimeout(() => {
$('#acceso').classList.add('saliendo'); velo.classList.add('papel'); velo.style.transition = 'opacity 1s ease'; velo.style.opacity = '1';
setTimeout(ir, 1000);
}, QUIETO ? 200 : 1100);
});
}
async function iniciar() {
grano(); enlazar();
try { const r = await fetch('c.json', { cache: 'no-store' }); if (!r.ok) throw new Error(String(r.status)); C = await r.json(); } catch (_) { C = null; }
if (!C) { body.classList.remove('cargando'); body.classList.add('sin-video'); velo.style.opacity = '0'; mostrarFormulario(); error('No se ha podido cargar la página. Comprueba la conexión y recarga.'); return; }
if (C.x && C.x.marca) { const m = $('#marcas'); m.src = C.x.marca; m.hidden = false; }
const s = leerSesion();
if (haySW()) { regP = navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }); regP.catch(() => {}); }
if (s && s.v === C.v && regP) {
$('#carga-txt').textContent = 'Abriendo…';
try { await abrir(b64d(s.k)); ir(); return; } catch (_) { borrarSesion(); }
} else if (s) { borrarSesion(); aviso('Hay una versión nueva de la web: escribe la clave otra vez.'); }
if (!haySW()) { aviso(MSG_SIN_SW); }
else { try { await regP; } catch (_) { aviso(MSG_SIN_SW); regP = null; } }
encajar();
body.classList.remove('cargando');
if (QUIETO || visto()) final(); else reproducir();
}
iniciar().catch(() => { body.classList.remove('cargando'); velo.style.opacity = '0'; mostrarFormulario(); });
})();
