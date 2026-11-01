/* ============================================================
   comun.js  -  Código compartido por la app de PC y la página del celular (jugador/index.html)

   Antes estas cosas estaban copiadas a mano en los dos lados (y podían quedar distintas). Ahora hay UNA sola copia:
     - versión del protocolo, prefijo de sala y servidores ICE
     - nombres de atributos, estados / condiciones, categorías del glosario
     - objetos predefinidos del mapa (árbol, muro, cofre...)
     - reglas de cálculo: modificador, habilidades, tamaño y escala de fichas, casillas
     - desempaquetado de imágenes que manda el DM ("@a12")

   REGLAS PARA TOCAR ESTE ARCHIVO
     - Solo lógica y datos: nada de document, state ni funciones de la app (tiene que funcionar en los dos sitios).
     - Si cambias algo de los MENSAJES de red, sube PROTO. App y celular deben tener la misma versión de este archivo.
     - Va dentro de la carpeta "jugador" a propósito: al subir esa carpeta a Netlify / GitHub Pages viaja junto con index.html.
   Prueba rápida:  node tests/comun.test.js
   ============================================================ */
(function (root) {
  'use strict';

  const PROTO = 5;                 // versión del protocolo de red (app de PC <-> celular)
  const PREFIX = 'tdc-';           // prefijo de los códigos de sala
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

  // ---------- Utilidades ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mod = v => Math.floor(((Number(v) || 10) - 10) / 2);          // modificador de una característica
  const fm = n => (n >= 0 ? '+' + n : '' + n);                         // +3 / -1

  // ---------- Atributos ----------
  const STAT_KEYS = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'];
  const STAT_ES = { Str: 'FUE', Dex: 'DES', Con: 'CON', Int: 'INT', Wis: 'SAB', Cha: 'CAR' };

  // Atributos extra de una hoja que cuentan como característica (los que el DM marcó con "attr")
  const xAttrs = c => (Array.isArray(c && c.extraStats) ? c.extraStats : []).filter(x => x.attr);
  const statValue = (c, k) => {
    if (/^x:/.test(k)) { const x = xAttrs(c).find(e => 'x:' + e.id === k); return x ? (Number(x.value) || 10) : 10; }
    return (c && c.stats && c.stats[k]) || 10;
  };
  const skillMod = (c, s) => mod(statValue(c, s.stat)) + (s.prof ? (c.prof || 0) : 0) + (s.bonus || 0);
  // Nombre del atributo de una habilidad; names = nombres que el DM renombró ({ Str: 'Fuerza', ... })
  const skillStatLabel = (c, s, names) => {
    if (/^x:/.test(s.stat)) { const x = xAttrs(c).find(e => 'x:' + e.id === s.stat); return x ? (x.name || 'Atributo') : '—'; }
    return (names && names[s.stat]) || STAT_ES[s.stat] || s.stat;
  };

  // ---------- Estados / condiciones ----------
  const CONDITIONS = [
    ['blinded', 'Cegado', '🕶️'], ['charmed', 'Hechizado', '💘'], ['deafened', 'Ensordecido', '🔇'], ['frightened', 'Asustado', '😱'],
    ['grappled', 'Agarrado', '✊'], ['incapacitated', 'Incapacitado', '🚫'], ['invisible', 'Invisible', '👻'], ['paralyzed', 'Paralizado', '⚡'],
    ['petrified', 'Petrificado', '🗿'], ['poisoned', 'Envenenado', '🤢'], ['prone', 'Derribado', '⬇️'], ['restrained', 'Apresado', '⛓️'],
    ['stunned', 'Aturdido', '💫'], ['unconscious', 'Inconsciente', '💤'], ['exhausted', 'Agotado', '🥵'], ['concentrating', 'Concentración', '🧠'],
    ['bleeding', 'Sangrando', '🩸'], ['burning', 'Ardiendo', '🔥'], ['blessed', 'Bendecido', '✨'], ['hasted', 'Acelerado', '💨'], ['slowed', 'Ralentizado', '🐌']
  ].map(([id, name, icon]) => ({ id, name, icon }));
  const condInfo = s => {
    const c = CONDITIONS.find(x => x.id === s);
    if (c) return c;
    return /^c:./.test(String(s)) ? { id: s, name: String(s).slice(2), icon: '🏷️' } : null;   // "c:Texto" = estado personalizado
  };
  const condIcons = (list, max = 6) => (list || []).map(condInfo).filter(Boolean).slice(0, max).map(c => c.icon).join('');
  const condText = s => { const c = condInfo(s); return c ? (/^c:/.test(s) ? c.name : c.icon + ' ' + c.name) : String(s); };

  // ---------- Glosario ----------
  const BOOK_CATS = [['regla', 'Regla'], ['conjuro', 'Conjuro'], ['objeto', 'Objeto'], ['criatura', 'Criatura'], ['lugar', 'Lugar'], ['personaje', 'Personaje'], ['otro', 'Otro']];

  // ---------- Objetos predefinidos del mapa ----------
  const svgUrl = (w, h, inner) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${inner}</svg>`);
  const OBJ_PRESETS = [
    { id: 'p_arbol', name: 'Árbol', w: 100, h: 100, url: svgUrl(100, 100, '<circle cx="50" cy="50" r="46" fill="#1f6b2c"/><circle cx="38" cy="40" r="24" fill="#2e8b3d"/><circle cx="62" cy="58" r="22" fill="#278036"/><circle cx="45" cy="44" r="10" fill="#4fae5f" opacity=".7"/>') },
    { id: 'p_arbusto', name: 'Arbusto', w: 50, h: 50, url: svgUrl(50, 50, '<circle cx="25" cy="27" r="21" fill="#2d7a3a"/><circle cx="18" cy="20" r="11" fill="#3c9a4c"/><circle cx="32" cy="30" r="10" fill="#34883f"/>') },
    { id: 'p_roca', name: 'Roca', w: 50, h: 50, url: svgUrl(50, 50, '<polygon points="8,34 14,14 30,6 44,16 46,36 30,44" fill="#7b8190" stroke="#4b5563" stroke-width="2"/><polygon points="14,14 30,6 28,22" fill="#a1a8b6"/>') },
    { id: 'p_muro', name: 'Muro de piedra', w: 150, h: 50, url: svgUrl(150, 50, '<defs><pattern id="b" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="#7b8190"/><path d="M0 12.5H25M12.5 0V12.5M0 12.5V25" stroke="#4b5563" stroke-width="2" fill="none"/></pattern></defs><rect x="1.5" y="1.5" width="147" height="47" fill="url(#b)" stroke="#374151" stroke-width="3"/>') },
    { id: 'p_valla', name: 'Valla', w: 150, h: 50, url: svgUrl(150, 50, '<rect x="1.5" y="14" width="147" height="22" rx="3" fill="#a16a3a" stroke="#5b3a1c" stroke-width="3"/><path d="M25 14V36M50 14V36M75 14V36M100 14V36M125 14V36" stroke="#5b3a1c" stroke-width="2"/>') },
    { id: 'p_puerta', name: 'Puerta', w: 50, h: 50, url: svgUrl(50, 50, '<rect x="3" y="12" width="44" height="26" rx="3" fill="#8b5a2b" stroke="#4a2f14" stroke-width="3"/><circle cx="38" cy="25" r="3" fill="#fbbf24"/><path d="M25 12V38" stroke="#4a2f14" stroke-width="2"/>') },
    { id: 'p_mesa', name: 'Mesa', w: 100, h: 50, url: svgUrl(100, 50, '<rect x="3" y="5" width="94" height="40" rx="8" fill="#a16a3a" stroke="#5b3a1c" stroke-width="3"/><rect x="10" y="12" width="80" height="26" rx="5" fill="#b87d48"/>') },
    { id: 'p_cofre', name: 'Cofre', w: 50, h: 50, url: svgUrl(50, 50, '<rect x="6" y="14" width="38" height="26" rx="4" fill="#8b5a2b" stroke="#4a2f14" stroke-width="3"/><rect x="6" y="14" width="38" height="9" rx="4" fill="#a8703a" stroke="#4a2f14" stroke-width="3"/><rect x="22" y="22" width="6" height="8" fill="#fbbf24" stroke="#92400e" stroke-width="1.5"/>') },
    { id: 'p_fogata', name: 'Fogata', w: 50, h: 50, url: svgUrl(50, 50, '<circle cx="25" cy="25" r="20" fill="none" stroke="#6b7280" stroke-width="6" stroke-dasharray="9 5"/><path d="M25 10C31 19 35 24 30 33 27 37 21 37 19 33 15 27 22 22 25 10Z" fill="#f97316"/><path d="M25 20C28 25 29 28 26 32 23 33 21 30 22 28 23 25 25 24 25 20Z" fill="#fde047"/>') },
    { id: 'p_columna', name: 'Columna', w: 50, h: 50, url: svgUrl(50, 50, '<circle cx="25" cy="25" r="20" fill="#9ca3af" stroke="#4b5563" stroke-width="3"/><circle cx="25" cy="25" r="11" fill="#d1d5db" stroke="#6b7280" stroke-width="2"/>') }
  ];
  const PRESET_URLS = Object.fromEntries(OBJ_PRESETS.map(p => [p.id, p.url]));

  // ---------- Cuadrícula y fichas ----------
  const GRID_DEFAULT = 50, GRID_MIN = 20, GRID_MAX = 150;
  const cleanGrid = g => { g = Math.round(Number(g)); return g > 0 ? clamp(g, GRID_MIN, GRID_MAX) : GRID_DEFAULT; };
  const tokSize = t => ([1, 2, 3].includes(Number(t && t.size)) ? Number(t.size) : 1);   // 1x1, 2x2 o 3x3 casillas
  const tokPx = (t, g) => tokSize(t) * g;                                                 // lado de la ficha en píxeles
  const tokScale = g => +(g / GRID_DEFAULT).toFixed(3);                                   // textos y adornos crecen con la casilla
  const initials = name => String(name || '?').slice(0, 2).toUpperCase();
  const snapAxis = (v, g, on) => (on ? Math.round(v / g) * g : v);

  // ---------- Imágenes por referencia ----------
  // El DM manda cada imagen grande UNA vez ("assets") y después solo su referencia corta ("@a12").
  // store guarda las ya recibidas; la función reemplaza las referencias por la imagen en el mensaje m.
  function unpackAssets(m, store) {
    if (m.assets) Object.assign(store, m.assets);
    const r = v => (typeof v === 'string' && v.charCodeAt(0) === 64 && store[v] !== undefined) ? store[v] : v;   // 64 = '@'
    if (Array.isArray(m.tokens)) m.tokens.forEach(t => { if (t && t.image) t.image = r(t.image); });
    if (Array.isArray(m.objects)) m.objects.forEach(o => { if (o) o.src = r(o.src); });
    if (Array.isArray(m.lib)) m.lib.forEach(o => { if (o) o.src = r(o.src); });
    if (m.view && m.view.bg) m.view.bg = r(m.view.bg);
    if (m.character && m.character.portrait) m.character.portrait = r(m.character.portrait);
    if (Array.isArray(m.gloss)) m.gloss.forEach(g => { if (g && g.img) g.img = r(g.img); });
  }

  root.TDC = Object.freeze({
    PROTO, PREFIX, ICE, clamp, esc, mod, fm,
    STAT_KEYS, STAT_ES, xAttrs, statValue, skillMod, skillStatLabel,
    CONDITIONS, condInfo, condIcons, condText, BOOK_CATS,
    svgUrl, OBJ_PRESETS, PRESET_URLS,
    GRID_DEFAULT, GRID_MIN, GRID_MAX, cleanGrid, tokSize, tokPx, tokScale, initials, snapAxis,
    unpackAssets
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TDC;
})(typeof window !== 'undefined' ? window : globalThis);
