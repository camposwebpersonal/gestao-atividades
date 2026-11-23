// Visualizador imersivo de imagens (neuroarquitetura): ocupa a tela inteira, fundo
// "ambilight" com a própria foto desfocada, navegação entre as fotos do mesmo lançamento,
// zoom pela roda do mouse (ancorado no cursor), botões − / + , duplo clique/toque,
// pinça com 2 dedos, arrastar para mover, deslizar para trocar de foto e girar.
// Envolve window.openLb (núcleo de carregamento progressivo em index.html) sem mudar sua assinatura.

const $ = id => document.getElementById(id);
const MIN = 1, MAX = 8;
const V = {list: [], i: 0, title: '', s: 1, tx: 0, ty: 0, rot: 0, ptrs: new Map(), pinch: null, pan: null, swipe: null, moved: false, lastTap: 0, internal: false};

function urlFromOnclick(el) {
  const raw = el.getAttribute?.('onclick') || '';
  const m = raw.match(/openL[bB]\(\s*(['"])(.*?)\1/);
  if (!m) return '';
  const t = document.createElement('textarea'); t.innerHTML = m[2]; return t.value;
}
function itemFromEl(el) {
  const full = el.dataset?.full || urlFromOnclick(el) || el.currentSrc || el.src;
  return full ? {src: full, alt: el.alt || '', preview: el.currentSrc || el.src || '', el} : null;
}
const GROUPS = '[data-lb-group],#gal-box,.img-section,.gallery-grid,.gal-grid,.poco-photos,.field-photos,.photo-grid,.ccd-photos,.rec-photos,.detail-photos,.modal-body,.page-content,#content';
function collect(src, trigger) {
  const el = trigger?.closest?.('img,[data-full]');
  if (!el) return [{src, alt: '', preview: ''}];
  const box = el.closest(GROUPS) || el.parentElement;
  const nodes = [...box.querySelectorAll('img[onclick*="openL"],img[data-full],[data-full][onclick]')];
  const seen = new Set(), list = [];
  for (const n of nodes) { const it = itemFromEl(n); if (it && !seen.has(it.src)) { seen.add(it.src); list.push(it); } }
  if (!list.some(x => x.src === src)) list.unshift({src, alt: el.alt || '', preview: el.currentSrc || el.src || ''});
  return list.length ? list : [{src, alt: '', preview: ''}];
}

/* ── transformação ── */
function stageRect() { return $('ivw-stage').getBoundingClientRect(); }
function baseSize() {
  const img = $('lb-img'), r = stageRect();
  const nw = img.naturalWidth || r.width, nh = img.naturalHeight || r.height;
  const rotated = V.rot % 180 !== 0;
  const w = rotated ? nh : nw, h = rotated ? nw : nh;
  const k = Math.min(r.width / w, r.height / h);
  return {w: w * k, h: h * k, r};
}
function clampPan() {
  const {w, h, r} = baseSize();
  const mx = Math.max(0, (w * V.s - r.width) / 2), my = Math.max(0, (h * V.s - r.height) / 2);
  V.tx = Math.min(mx, Math.max(-mx, V.tx)); V.ty = Math.min(my, Math.max(-my, V.ty));
}
function fitImage() {
  const img = $('lb-img'), r = stageRect();
  if (!img.naturalWidth) return;
  const rotated = V.rot % 180 !== 0;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const k = Math.min(r.width / (rotated ? nh : nw), r.height / (rotated ? nw : nh));
  // Usa o maior tamanho possível da tela (amplia fotos pequenas até preencher, como num visualizador nativo)
  img.style.width = Math.round(nw * k) + 'px'; img.style.height = Math.round(nh * k) + 'px';
}
function apply(animate) {
  const img = $('lb-img');
  clampPan();
  img.style.transition = animate ? 'transform .22s cubic-bezier(.2,.8,.2,1)' : 'none';
  img.style.transform = `translate(${V.tx}px,${V.ty}px) scale(${V.s}) rotate(${V.rot}deg)`;
  $('ivw-pct').textContent = Math.round(V.s * 100) + '%';
  $('ivw-out').disabled = V.s <= MIN + 0.001; $('ivw-in').disabled = V.s >= MAX - 0.001;
  $('lightbox').classList.toggle('is-zoomed', V.s > 1.001);
}
function zoomAt(ns, cx, cy, animate) {
  ns = Math.min(MAX, Math.max(MIN, ns));
  const r = stageRect();
  const px = (cx ?? r.left + r.width / 2) - (r.left + r.width / 2), py = (cy ?? r.top + r.height / 2) - (r.top + r.height / 2);
  const f = ns / V.s;
  V.tx = px - (px - V.tx) * f; V.ty = py - (py - V.ty) * f; V.s = ns;
  if (ns === MIN) { V.tx = 0; V.ty = 0; }
  apply(animate);
}
function reset(animate) { V.s = 1; V.tx = 0; V.ty = 0; apply(animate); }

/* ── UI ── */
let hintTimer = 0;
function hint(text) { const h = $('ivw-hint'); h.textContent = text; h.classList.add('on'); clearTimeout(hintTimer); hintTimer = setTimeout(() => h.classList.remove('on'), 2200); }
function paint() {
  const n = V.list.length, it = V.list[V.i] || {};
  $('ivw-title').textContent = V.title || it.alt || 'Imagem';
  const c = $('ivw-count'); c.hidden = n < 2; c.textContent = `${V.i + 1} / ${n}`;
  $('ivw-prev').hidden = $('ivw-next').hidden = n < 2;
  $('ivw-open').href = it.src || '#';
  const amb = $('ivw-amb'); amb.style.backgroundImage = it.preview || it.src ? `url("${String(it.preview || it.src).replace(/"/g, '%22')}")` : '';
  const strip = $('ivw-strip'); strip.hidden = n < 2; $('lightbox').classList.toggle('has-strip', n >= 2);
  if (n >= 2) {
    strip.innerHTML = V.list.map((x, k) => `<button type="button" class="ivw-th${k === V.i ? ' on' : ''}" data-k="${k}" aria-label="Ver imagem ${k + 1} de ${n}"${k === V.i ? ' aria-current="true"' : ''}><img src="${String(x.preview || x.src).replace(/"/g, '&quot;')}" alt="" loading="lazy" draggable="false"></button>`).join('');
    strip.querySelector('.on')?.scrollIntoView({block: 'nearest', inline: 'center'});
  } else strip.innerHTML = '';
}
function show(k, dir) {
  const n = V.list.length; if (!n) return;
  V.i = (k + n) % n; V.rot = 0;
  const it = V.list[V.i], img = $('lb-img');
  img.classList.remove('ivw-in-l', 'ivw-in-r'); void img.offsetWidth;
  if (dir) img.classList.add(dir > 0 ? 'ivw-in-r' : 'ivw-in-l');
  V.internal = true;
  try { BASE(it.src, it.alt || V.title || 'Foto ampliada', it.preview && it.preview !== it.src ? it.preview : '', it.src); } finally { V.internal = false; }
  reset(false); paint();
  // pré-carrega vizinhas para a troca ser instantânea
  if (n > 1) { window.preloadLb?.(V.list[(V.i + 1) % n].src); window.preloadLb?.(V.list[(V.i - 1 + n) % n].src); }
}
const next = () => show(V.i + 1, 1), prev = () => show(V.i - 1, -1);

/* API pública: abrir lista diretamente */
window.openImageViewer = (list, index = 0, title = '') => {
  V.list = (list || []).map(x => typeof x === 'string' ? {src: x, alt: '', preview: ''} : x).filter(x => x && x.src);
  if (!V.list.length) return;
  V.title = title; show(Math.min(Math.max(0, index), V.list.length - 1), 0);
  if (!sessionStorage.getItem('ivw-hint')) { try { sessionStorage.setItem('ivw-hint', '1'); } catch (_) {} hint(matchMedia('(pointer:coarse)').matches ? 'Pince com 2 dedos para ampliar · deslize para trocar' : 'Role o mouse para ampliar · arraste para mover · ← → trocam'); }
};

let BASE = null;
function install() {
  if (typeof window.openLb !== 'function' || !$('ivw-stage')) return setTimeout(install, 60);
  if (window.openLb.__ivw) return;
  BASE = window.openLb;
  const wrapped = (src, alt = 'Foto ampliada', preview = '', displaySrc = src) => {
    if (V.internal) return BASE(src, alt, preview, displaySrc);
    const trigger = window.event?.target;
    const list = collect(src, trigger);
    const idx = Math.max(0, list.findIndex(x => x.src === src));
    if (list[idx]) { list[idx] = {...list[idx], alt: list[idx].alt || alt, preview: preview || list[idx].preview}; }
    V.list = list; V.title = alt && alt !== 'Foto ampliada' ? alt : (trigger?.closest?.('[data-lb-title]')?.dataset.lbTitle || '');
    V.i = idx; V.rot = 0;
    V.internal = true; try { BASE(src, alt, preview, displaySrc); } finally { V.internal = false; }
    reset(false); paint();
    if (list.length > 1) { window.preloadLb?.(list[(idx + 1) % list.length].src); }
  };
  wrapped.__ivw = true;
  window.openLb = window.openLB = wrapped;

  // Galeria do lançamento (miniatura na linha): abre direto no visualizador, sem janela intermediária.
  const og = window.openGal;
  if (typeof og === 'function' && !og.__ivw) {
    const g = async (type, id, name) => {
      await og(type, id, name);
      const imgs = [...document.querySelectorAll('#gal-box img')];
      if (!imgs.length) return; // mantém o aviso "Nenhuma imagem cadastrada"
      window.closeGal?.();
      const list = []; const seen = new Set();
      imgs.forEach(im => { const it = itemFromEl(im); if (it && !seen.has(it.src)) { seen.add(it.src); list.push({src: it.src, alt: name || '', preview: ''}); } });
      window.openImageViewer(list, 0, name || '');
    };
    g.__ivw = true; window.openGal = g;
  }
  bind();
}

function bind() {
  const box = $('lightbox'), stage = $('ivw-stage'), img = $('lb-img');
  img.addEventListener('load', () => { fitImage(); apply(false); });
  addEventListener('resize', () => { if (box.style.display === 'flex') { fitImage(); apply(false); } });
  $('ivw-in').onclick = () => zoomAt(V.s * 1.5, null, null, true);
  $('ivw-out').onclick = () => zoomAt(V.s / 1.5, null, null, true);
  $('ivw-pct').onclick = () => (V.s > 1.001 ? reset(true) : zoomAt(2, null, null, true));
  $('ivw-rot').onclick = () => { V.rot = (V.rot + 90) % 360; fitImage(); reset(true); };
  $('ivw-prev').onclick = prev; $('ivw-next').onclick = next;
  $('ivw-strip').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { const k = +b.dataset.k; show(k, k > V.i ? 1 : -1); } });
  const observer = new MutationObserver(() => { if (box.style.display !== 'flex') { V.ptrs.clear(); V.pinch = V.pan = V.swipe = null; box.classList.remove('is-zoomed'); } });
  observer.observe(box, {attributes: true, attributeFilter: ['style']});

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const k = Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * (e.ctrlKey ? 0.01 : 0.0022));
    zoomAt(V.s * k, e.clientX, e.clientY, false);
  }, {passive: false});

  stage.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    try { stage.setPointerCapture?.(e.pointerId); } catch (_) {}
    V.ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
    V.moved = false;
    if (V.ptrs.size === 2) {
      const [a, b] = [...V.ptrs.values()];
      V.pinch = {d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: V.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, tx: V.tx, ty: V.ty};
      V.pan = V.swipe = null;
    } else if (V.ptrs.size === 1) {
      if (V.s > 1.001) V.pan = {x: e.clientX, y: e.clientY, tx: V.tx, ty: V.ty};
      else V.swipe = {x: e.clientX, y: e.clientY, t: performance.now()};
    }
  });
  stage.addEventListener('pointermove', e => {
    if (!V.ptrs.has(e.pointerId)) return;
    V.ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (V.pinch && V.ptrs.size >= 2) {
      const [a, b] = [...V.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const r = stageRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ns = Math.min(MAX, Math.max(MIN, V.pinch.s * d / V.pinch.d)), f = ns / V.pinch.s;
      // mantém o ponto entre os dedos parado e acompanha o arraste dos dois dedos
      V.tx = (mx - cx) - ((V.pinch.mx - cx) - V.pinch.tx) * f; V.ty = (my - cy) - ((V.pinch.my - cy) - V.pinch.ty) * f; V.s = ns;
      V.moved = true; apply(false);
    } else if (V.pan) {
      const dx = e.clientX - V.pan.x, dy = e.clientY - V.pan.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) V.moved = true;
      V.tx = V.pan.tx + dx; V.ty = V.pan.ty + dy; apply(false);
    } else if (V.swipe) {
      const dx = e.clientX - V.swipe.x;
      if (Math.abs(dx) > 6) { V.moved = true; img.style.transition = 'none'; img.style.transform = `translate(${V.list.length > 1 ? dx : dx * .25}px,0) rotate(${V.rot}deg)`; }
    }
  });
  const end = e => {
    if (!V.ptrs.has(e.pointerId)) return;
    V.ptrs.delete(e.pointerId);
    if (V.pinch) { if (V.ptrs.size < 2) { V.pinch = null; if (V.s < 1.02) reset(true); const rest = [...V.ptrs.values()][0]; if (rest && V.s > 1.001) V.pan = {x: rest.x, y: rest.y, tx: V.tx, ty: V.ty}; } return; }
    if (V.swipe) {
      const dx = e.clientX - V.swipe.x, dt = performance.now() - V.swipe.t; V.swipe = null;
      if (V.list.length > 1 && (Math.abs(dx) > 70 || (Math.abs(dx) > 30 && dt < 250))) { dx < 0 ? next() : prev(); return; }
      if (V.moved) { reset(true); return; }
    }
    V.pan = null;
    if (!V.moved && e.pointerType !== 'mouse' || (!V.moved && e.type === 'pointerup')) tap(e);
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', e => { V.ptrs.delete(e.pointerId); V.pinch = V.pan = V.swipe = null; apply(true); });

  function tap(e) {
    const now = performance.now();
    if (now - V.lastTap < 300) { V.lastTap = 0; clearTimeout(tap.t); V.s > 1.001 ? reset(true) : zoomAt(2.5, e.clientX, e.clientY, true); return; }
    V.lastTap = now;
    const onImg = e.target === img;
    clearTimeout(tap.t);
    // toque simples fora da foto (sem zoom) fecha, como nos visualizadores nativos
    if (!onImg && V.s <= 1.001) tap.t = setTimeout(() => { if (V.lastTap === now) window.closeLb(); }, 300);
  }

  document.addEventListener('keydown', e => {
    if (box.style.display !== 'flex') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); V.s > 1.001 ? (V.tx -= 80, apply(true)) : next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); V.s > 1.001 ? (V.tx += 80, apply(true)) : prev(); }
    else if (e.key === 'ArrowUp' && V.s > 1.001) { e.preventDefault(); V.ty += 80; apply(true); }
    else if (e.key === 'ArrowDown' && V.s > 1.001) { e.preventDefault(); V.ty -= 80; apply(true); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(V.s * 1.5, null, null, true); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(V.s / 1.5, null, null, true); }
    else if (e.key === '0') { e.preventDefault(); reset(true); }
    else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); $('ivw-rot').click(); }
  });
}

install();
