/* ============================================================
   Baiking · Curso + Participación — frontend
   Renderiza el sitio a partir de config/campaign.json (o de
   window.__CAMPAIGN__ cuando la página fue "empaquetada").
   ============================================================ */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const TZ = 'America/Argentina/Buenos_Aires';

  const fmtARS = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const fmtNum = (n) => String(n).padStart(4, '0');
  const fmtFechaLarga = (iso) =>
    new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(new Date(iso));
  const fmtHora = (iso) =>
    new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(iso));
  const fmtCorta = (iso) =>
    new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', timeZone: TZ }).format(new Date(iso));
  const parteFecha = (iso, part) =>
    new Intl.DateTimeFormat('es-AR', { [part]: part === 'day' ? 'numeric' : 'short', timeZone: TZ }).format(new Date(iso));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Valores de la config marcados "[A CONFIRMAR]": nunca se muestran tal cual en el sitio.
  const pendiente = (s) => /\[A CONFIRMAR\]/i.test(String(s ?? ''));
  const valor = (s) => String(s ?? '').replace(/\[A CONFIRMAR\]\s*/gi, '').trim();
  const marcar = (el, v, placeholder) => {
    if (pendiente(v)) el.innerHTML = `<mark>${esc(placeholder)}</mark>`;
    else el.textContent = v;
  };

  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* privado / bloqueado */
      }
    },
  };

  const PROVINCIAS = [
    'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
    'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
    'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
  ];

  const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"></use></svg>`;

  /* ---------- sprite de íconos ---------- */
  async function injectSprite() {
    if (document.getElementById('sprite-root')) return;
    let svg = window.__SPRITE__;
    if (!svg) {
      try {
        const res = await fetch('assets/img/sprite.svg');
        if (!res.ok) return;
        svg = await res.text();
      } catch {
        return;
      }
    }
    const holder = document.createElement('div');
    holder.id = 'sprite-root';
    holder.innerHTML = svg;
    document.body.prepend(holder);
  }

  /* ---------- config ---------- */
  async function loadConfig() {
    if (window.__CAMPAIGN__) return window.__CAMPAIGN__;
    if (location.protocol === 'file:') {
      throw new Error('Este archivo necesita un servidor: corré "npm run dev" o abrí dist/index.html (versión autocontenida).');
    }
    const res = await fetch('config/campaign.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('No pudimos cargar la información de la campaña.');
    return res.json();
  }

  /* ---------- estado ---------- */
  const state = { cfg: null, bici: null, pack: null, onPackChange: null };

  // Nombre de la unidad ("chance"/"chances" o "participación"/"participaciones"), configurable.
  const unidad = (n) => {
    const u = state.cfg?.unidad || { singular: 'participación', plural: 'participaciones' };
    return n === 1 ? u.singular : u.plural;
  };
  const nombrePack = (p) => p.nombre || `${p.participaciones} ${unidad(p.participaciones)}`;

  function setBici(id, { scrollToPacks = false } = {}) {
    if (!state.cfg.bicis.some((b) => b.id === id)) return;
    state.bici = id;
    store.set('baiking_bici', id);
    $$('.bike-card').forEach((c) => c.classList.toggle('is-selected', c.dataset.bici === id));
    $$('.bike-card .btn-select').forEach((b) => {
      const sel = b.closest('.bike-card').dataset.bici === id;
      b.textContent = sel ? 'Elegida ✓' : 'Quiero esta';
    });
    $$('.thumb[data-bici]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bici === id)));
    $$('input[name="bici_preferida"]').forEach((r) => (r.checked = r.value === id));
    if (scrollToPacks) $('#packs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* Selección global del pack: sincroniza todas las escaleras (hero, sección, modal). */
  function setPackGlobal(id) {
    const cfg = state.cfg;
    const pack = cfg.packs.find((p) => p.id === id) || cfg.packs.find((p) => p.destacado) || cfg.packs[0];
    state.pack = pack.id;
    $$('.ladder input[type="radio"]').forEach((r) => (r.checked = r.value === pack.id));
    const mb = $('#mobile-bar-info');
    if (mb) mb.innerHTML = `${esc(nombrePack(pack))} · ${fmtARS(pack.precio)}<b>Incluye el curso completo</b>`;
    if (state.onPackChange) state.onPackChange(pack.id);
  }

  /* Escalera de precios (radios). Se usa en el hero, en la sección de packs y en el modal. */
  function renderLadder(container, name) {
    if (!container) return;
    const cfg = state.cfg;
    container.innerHTML = cfg.packs
      .map(
        (p) => `
        <label class="ladder-item" data-pack="${esc(p.id)}">
          <input type="radio" name="${esc(name)}" value="${esc(p.id)}" ${p.id === state.pack ? 'checked' : ''}>
          <span class="q"><b>${esc(nombrePack(p))}</b> para el sorteo${p.etiqueta ? `<span class="tag">${esc(p.etiqueta)}</span>` : ''}</span>
          <span class="p">${fmtARS(p.precio)}</span>
        </label>`,
      )
      .join('');
    container.addEventListener('change', (e) => {
      if (e.target.name === name) setPackGlobal(e.target.value);
    });
  }

  /* ---------- hero tipo tienda ---------- */
  function renderShopHero(cfg) {
    const media = $('#shop-photo-media');
    if (media) {
      media.innerHTML = cfg.marca.foto_hero
        ? `<img src="${esc(cfg.marca.foto_hero)}" alt="${esc(cfg.marca.foto_hero_alt || '')}">`
        : `<div class="shop-placeholder">
            <div class="shop-placeholder-art">
              ${cfg.bicis.map((b) => `<svg viewBox="0 0 400 240" role="img" aria-label="${esc(b.nombre)}"><use href="#art-${esc(b.ilustracion)}"></use></svg>`).join('')}
            </div>
            <p><b>Acá va la foto del local</b>Gastón con las dos Polygon en la puerta de Baiking, Del Viso</p>
          </div>`;
    }
    const thumbs = $('#shop-thumbs');
    if (thumbs) {
      thumbs.innerHTML = cfg.bicis
        .map(
          (b) => `
          <button type="button" class="thumb" data-bici="${esc(b.id)}" aria-pressed="false">
            ${b.imagen ? `<img src="${esc(b.imagen)}" alt="">` : `<svg viewBox="0 0 400 240" aria-hidden="true"><use href="#art-${esc(b.ilustracion)}"></use></svg>`}
            <span><b>${esc(b.nombre.replace('Polygon ', ''))}</b><span>${esc(b.tipo)}</span></span>
          </button>`,
        )
        .join('');
      thumbs.addEventListener('click', (e) => {
        const btn = e.target.closest('.thumb[data-bici]');
        if (btn) setBici(btn.dataset.bici);
      });
    }
    renderLadder($('#ladder'), 'pack_hero');
    initCountdown(cfg.edicion.cierre_ventas);
    initProgreso(cfg);
  }

  /* Textos comunes a todas las páginas (fechas, Instagram, seguidores). */
  function renderCommon(cfg) {
    const { edicion } = cfg;
    // Fechas en minúscula y sin coma ("viernes 4 de diciembre"): van en medio de oraciones.
    $$('[data-fecha-sorteo]').forEach((el) => (el.textContent = fmtFechaTexto(edicion.fecha_sorteo)));
    $$('[data-fecha-sorteo-completa]').forEach((el) => (el.textContent = fmtFechaTexto(edicion.fecha_sorteo, true)));
    $$('[data-fecha-sorteo-corta]').forEach((el) => (el.textContent = fmtCorta(edicion.fecha_sorteo)));
    $$('[data-hora-sorteo]').forEach((el) => (el.textContent = `${fmtHora(edicion.fecha_sorteo)} hs`));
    $$('[data-cierre]').forEach(
      (el) => (el.textContent = `${fmtFechaTexto(edicion.cierre_ventas, true)} a las ${fmtHora(edicion.cierre_ventas)} hs`),
    );
    $$('[data-edicion-nombre]').forEach((el) => (el.textContent = edicion.nombre));
    $$('[data-curso-nombre]').forEach((el) => (el.textContent = cfg.curso.nombre));
    $$('[data-instagram]').forEach((el) => (el.textContent = `@${cfg.contacto.instagram}`));
    $$('[data-seguidores]').forEach((el) => (el.textContent = cfg.marca.seguidores_instagram || ''));
    $$('[data-unidad-plural]').forEach((el) => (el.textContent = unidad(2)));
    $$('[data-unidad-plural-cap]').forEach((el) => (el.textContent = cap(unidad(2))));
    $$('[data-unidad-singular]').forEach((el) => (el.textContent = unidad(1)));
  }
  const fmtFechaTexto = (iso, conAnio = false) =>
    new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(conAnio ? { year: 'numeric' } : {}),
      timeZone: TZ,
    })
      .format(new Date(iso))
      .replace(',', '');

  /* Barra de progreso: lineal en el tiempo. 0 % al inicio de la edición y 100 % el día
     del sorteo (no depende de cuántas chances se vendieron: no hay tope de chances). */
  function initProgreso(cfg) {
    const strip = $('#progreso');
    if (!strip) return;
    const { edicion } = cfg;
    const inicio = new Date(edicion.inicio || `${cfg.legal.vigencia_desde}T00:00:00-03:00`).getTime();
    const fin = new Date(edicion.fecha_sorteo).getTime();
    const pintar = (pct) => {
      pct = Math.max(0, Math.min(100, pct));
      $('#prog-pct').textContent = `${pct < 10 && pct > 0 ? pct.toFixed(1).replace('.', ',') : Math.round(pct)} %`;
      strip.setAttribute('title', `Del ${fmtCorta(inicio)} al ${fmtCorta(fin)}`);
      $('.progress-bar', strip).setAttribute('aria-valuenow', String(Math.round(pct)));
      strip.classList.toggle('is-hot', pct >= 80);
      strip.hidden = false;
      requestAnimationFrame(() => ($('#prog-fill').style.width = `${pct}%`));
    };
    const calcular = () => (fin > inicio ? ((Date.now() - inicio) / (fin - inicio)) * 100 : 0);
    // En modo demo (antes de lanzar) se muestra un valor de ejemplo para que la barra se vea.
    if (cfg.checkout.modo === 'demo' && typeof edicion.progreso_demo_pct === 'number' && Date.now() < inicio) {
      pintar(edicion.progreso_demo_pct);
      return;
    }
    pintar(calcular());
    setInterval(() => pintar(calcular()), 60000);
  }

  /* Cuenta regresiva en una línea: "66 días 04:21:53" (hasta el cierre de inscripciones). */
  function initCountdown(iso) {
    const el = $('#countdown-inline');
    if (!el) return;
    const label = $('#countdown-label');
    const target = new Date(iso).getTime();
    const dos = (n) => String(n).padStart(2, '0');
    const tick = () => {
      let diff = Math.max(0, target - Date.now());
      if (diff === 0) {
        if (label) label.textContent = 'Las inscripciones ya cerraron';
        el.textContent = '';
        return true;
      }
      const d = Math.floor(diff / 864e5);
      diff -= d * 864e5;
      const h = Math.floor(diff / 36e5);
      diff -= h * 36e5;
      const m = Math.floor(diff / 6e4);
      const s = Math.floor((diff - m * 6e4) / 1e3);
      el.textContent = `${d} ${d === 1 ? 'día' : 'días'} ${dos(h)}:${dos(m)}:${dos(s)}`;
      return false;
    };
    if (!tick()) {
      const timer = setInterval(() => tick() && clearInterval(timer), 1000);
    }
  }

  /* ---------- bicis ---------- */
  function renderBikes(cfg) {
    const grid = $('#bikes-grid');
    if (!grid) return;
    grid.innerHTML = cfg.bicis
      .map((b) => {
        const chip = b.ilustracion === 'gravel' ? 'chip is-gravel' : 'chip is-accent';
        const media = b.imagen
          ? `<img src="${esc(b.imagen)}" alt="${esc(b.nombre)}" loading="lazy">`
          : `<svg class="bike-art" viewBox="0 0 400 240" role="img" aria-label="${esc(b.nombre)} (ilustración)"><use href="#art-${esc(b.ilustracion)}"></use></svg>`;
        const valor =
          typeof b.valor_referencia === 'number'
            ? `<div class="price">Valor de referencia<b>${fmtARS(b.valor_referencia)}</b></div>`
            : `<div class="price">Valor de referencia<b>a confirmar</b></div>`;
        return `
        <article class="bike-card reveal" data-bici="${esc(b.id)}">
          <div class="bike-media">
            <span class="${chip}">${esc(b.tipo)}</span>
            ${media}
          </div>
          <div class="bike-body">
            <h3><small>${esc(b.marca)}</small>${esc(b.nombre.replace('Polygon ', ''))}</h3>
            <p class="tagline">${esc(b.tagline)}</p>
            <ul class="specs">
              ${b.specs.map((s) => `<li>${esc(s.k)}<b>${esc(s.v)}</b></li>`).join('')}
            </ul>
            <div class="bike-foot">
              ${valor}
              <button type="button" class="btn btn-ghost btn-select" data-select="${esc(b.id)}">Quiero esta</button>
            </div>
          </div>
        </article>`;
      })
      .join('');
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-select]');
      if (btn) setBici(btn.dataset.select, { scrollToPacks: true });
    });
    const incluye = $('#premio-incluye');
    if (incluye) {
      const icons = ['ico-check', 'ico-users', 'ico-star', 'ico-wrench', 'ico-shield'];
      incluye.innerHTML = (cfg.premio.incluye || [])
        .map((t, i) => `<li>${icon(icons[i % icons.length])}<span>${esc(t)}</span></li>`)
        .join('');
    }
    $$('[data-premio-entrega]').forEach((el) => cfg.premio.entrega && (el.textContent = cfg.premio.entrega));
  }

  /* ---------- curso ---------- */
  function renderCourse(cfg) {
    const { curso } = cfg;
    $$('[data-curso-descripcion]').forEach((el) => (el.textContent = curso.descripcion));
    $$('[data-curso-docente]').forEach((el) => (el.textContent = curso.docente));
    const fmt = $('#course-format');
    if (fmt && Array.isArray(curso.formato)) {
      const icons = ['ico-video', 'ico-doc', 'ico-infinity', 'ico-chat'];
      fmt.innerHTML = curso.formato.map((f, i) => `<li>${icon(icons[i % icons.length])}${esc(f)}</li>`).join('');
    }
    const mods = $('#modules');
    if (mods) {
      mods.innerHTML = curso.modulos
        .map(
          (m, i) => `
        <li class="module reveal">
          <span class="n">${String(i + 1).padStart(2, '0')}</span>
          <div><h4>${esc(m.titulo)}</h4>${m.descripcion ? `<p>${esc(m.descripcion)}</p>` : ''}</div>
          ${m.duracion ? `<span class="dur">${esc(m.duracion)}</span>` : ''}
        </li>`,
        )
        .join('');
    }
  }

  /* ---------- packs (segunda escalera, más abajo en la página) ---------- */
  function renderPacks() {
    renderLadder($('#ladder-packs'), 'pack_seccion');
  }

  /* ---------- sorteo ---------- */
  function renderDraw(cfg) {
    const { edicion, sorteo } = cfg;
    const cal = $('#draw-cal');
    if (cal) {
      cal.innerHTML = `<b>${esc(parteFecha(edicion.fecha_sorteo, 'month').replace('.', ''))}</b><strong>${esc(
        parteFecha(edicion.fecha_sorteo, 'day'),
      )}</strong><span>${esc(fmtHora(edicion.fecha_sorteo))} hs</span>`;
    }
    const rules = $('#rules');
    if (rules) {
      const icons = ['ico-hash', 'ico-live', 'ico-shield', 'ico-users'];
      rules.innerHTML = sorteo.reglas
        .map((r, i) => `<li>${icon(icons[i % icons.length])}<div><b>${esc(r.titulo)}.</b> ${esc(r.texto)}</div></li>`)
        .join('');
    }
    // Ganadores y premios adicionales solo se muestran cuando existen
    // (en la primera edición, ninguno de los dos).
    const secundarios = sorteo.premios_secundarios || [];
    const ganadores = cfg.ganadores || [];
    const sec = $('#secondary-prizes');
    if (sec) {
      sec.innerHTML = secundarios
        .map((p) => `<li><b>${esc(p.puesto)}</b><span>${esc(p.detalle)}</span></li>`)
        .join('');
      $('#secondary-block').hidden = secundarios.length === 0;
    }
    const win = $('#winners');
    if (win) {
      win.innerHTML = ganadores
        .map(
          (g) =>
            `<li class="winner"><span class="num">${esc(fmtNum(g.numero))}</span><div><b>${esc(g.nombre)}</b><span>${esc(g.localidad)} · ${esc(g.premio)}</span></div></li>`,
        )
        .join('');
      $('#winners-block').hidden = ganadores.length === 0;
    }
    const side = $('#draw-side');
    if (side) {
      const vacio = secundarios.length === 0 && ganadores.length === 0;
      side.hidden = vacio;
      $('.draw-grid')?.classList.toggle('is-single', vacio);
    }
  }

  /* ---------- faq ---------- */
  function renderFaq(cfg) {
    const el = $('#faq');
    if (!el) return;
    el.innerHTML = cfg.faq
      .map((f) => `<details class="reveal"><summary>${esc(f.p)}</summary><p>${esc(f.r)}</p></details>`)
      .join('');
  }

  /* ---------- contacto / legal ---------- */
  function renderContact(cfg) {
    const { contacto, legal, marca } = cfg;
    const wa = `https://wa.me/${contacto.whatsapp}?text=${encodeURIComponent(contacto.whatsapp_mensaje)}`;
    $$('[data-wa]').forEach((a) => {
      a.href = wa;
      a.target = '_blank';
      a.rel = 'noopener';
    });
    $$('[data-ig]').forEach((a) => {
      a.href = `https://instagram.com/${contacto.instagram}`;
      a.target = '_blank';
      a.rel = 'noopener';
    });
    $$('[data-direccion]').forEach((el) => (el.textContent = contacto.direccion));
    $$('[data-horarios]').forEach((el) => (el.textContent = contacto.horarios || ''));
    const email = valor(contacto.email);
    $$('[data-email]').forEach((el) => {
      el.textContent = email;
      if (el.tagName === 'A') el.href = `mailto:${email}`;
    });
    $$('[data-web]').forEach((el) => {
      el.textContent = marca.web.replace(/^https?:\/\//, '');
      if (el.tagName === 'A') el.href = marca.web;
    });
    $$('[data-legal-leyenda]').forEach((el) => (el.textContent = legal.leyenda));
    $$('[data-legal-aviso]').forEach((el) => (el.textContent = legal.aviso_corto));
    // Razón social y CUIT solo cuando están confirmados; mientras tanto, el nombre comercial.
    const organizador = pendiente(legal.razon_social) || pendiente(legal.cuit)
      ? 'Organiza Baiking Tienda de Bicis'
      : `Organiza ${legal.razon_social} · CUIT ${legal.cuit}`;
    $$('[data-legal-organizador]').forEach((el) => (el.textContent = organizador));
    $$('[data-legal-razon-social]').forEach((el) => marcar(el, legal.razon_social, '[razón social]'));
    $$('[data-legal-cuit]').forEach((el) => marcar(el, legal.cuit, '[CUIT]'));
    $$('[data-legal-domicilio]').forEach((el) => (el.textContent = legal.domicilio));
    $$('[data-gratuita-texto]').forEach((el) => (el.textContent = cfg.participacion_gratuita?.texto || ''));
    // Logo real de Baiking (marca.logo) en los headers que todavía muestran el nombre en tipografía.
    if (marca.logo) {
      $$('.logo').forEach((a) => {
        if (a.querySelector('img')) return;
        const small = a.querySelector('small');
        a.innerHTML = `<img src="${esc(marca.logo)}" alt="Baiking">${small ? small.outerHTML : ''}`;
      });
    }
    const foto = $('#about-photo');
    if (foto && marca.foto_gaston) {
      foto.innerHTML = `<img src="${esc(marca.foto_gaston)}" alt="${esc(marca.foto_gaston_alt || '')}" loading="lazy">`;
      foto.classList.add('has-photo');
      foto.hidden = false;
    }
    $$('[data-gratuita]').forEach((el) => {
      if (!cfg.participacion_gratuita?.habilitada) el.hidden = true;
    });
    $$('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));
  }

  /* ---------- modal de inscripción ---------- */
  function initModal(cfg) {
    const modal = $('#modal');
    if (!modal) return;
    const form = $('#form-inscripcion');
    const picker = $('#pack-picker');
    const bikePicker = $('#bike-picker');
    const provSel = $('#f-provincia');
    const errorBox = $('#form-error');
    const successView = $('#modal-success');
    const formView = $('#modal-form');

    if (provSel) {
      provSel.innerHTML =
        `<option value="">Elegí tu provincia</option>` +
        PROVINCIAS.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    }

    renderLadder(picker, 'pack_modal');
    state.onPackChange = (id) => setPack(id);

    bikePicker.innerHTML = cfg.bicis
      .map(
        (b) => `
        <label><input type="radio" id="bici-${esc(b.id)}" name="bici_preferida" value="${esc(b.id)}">${esc(b.nombre.replace('Polygon ', ''))}<span>${esc(b.tipo)}</span></label>`,
      )
      .join('');
    bikePicker.addEventListener('change', (e) => {
      if (e.target.name === 'bici_preferida') setBici(e.target.value);
    });

    // Medios de pago según la config: transferencia (checkout.transferencia) y/o Mercado Pago
    // (checkout.mercadopago). Si hay uno solo, no se muestra el selector.
    const tr = cfg.checkout.transferencia;
    const externo = cfg.checkout.modo === 'externo';
    const transferenciaOn = Boolean(tr && tr.habilitada) && !externo;
    const mercadopagoOn = (cfg.checkout.mercadopago ? cfg.checkout.mercadopago.habilitada !== false : true) && !externo;
    const payPicker = $('#pay-picker');
    if (transferenciaOn && mercadopagoOn) {
      $('#pago-field').hidden = false;
      payPicker.innerHTML = `
        <label><input type="radio" id="pago-mp" name="medio_pago" value="mercadopago" checked>Mercado Pago<span>Tarjeta de crédito, débito o dinero en cuenta. Confirmación al instante.</span></label>
        <label><input type="radio" id="pago-tr" name="medio_pago" value="transferencia">Transferencia bancaria ${
          tr.descuento_pct ? `<em>${esc(String(tr.descuento_pct))} % de descuento</em>` : ''
        }<span>Te damos el alias y un código, subís el comprobante y lo confirmamos en menos de ${esc(String(tr.plazo_horas || 48))} hs.</span></label>`;
      payPicker.addEventListener('change', () => setPack(state.pack));
    }
    const medioElegido = () => {
      if (transferenciaOn && !mercadopagoOn) return 'transferencia';
      if (transferenciaOn && mercadopagoOn) return form.elements.medio_pago?.value || 'mercadopago';
      return 'mercadopago';
    };
    const totalPack = (pack, medio) =>
      medio === 'transferencia' && tr?.descuento_pct ? Math.round(pack.precio * (1 - tr.descuento_pct / 100)) : pack.precio;

    // Actualiza el resumen del modal para el pack elegido (la selección global vive en setPackGlobal).
    function setPack(id) {
      const pack = cfg.packs.find((p) => p.id === id) || cfg.packs.find((p) => p.destacado) || cfg.packs[0];
      const bici = cfg.bicis.find((b) => b.id === state.bici);
      const medio = medioElegido();
      const total = totalPack(pack, medio);
      $('#sum-pack').textContent = nombrePack(pack);
      $('#sum-part').textContent = `Curso completo + ${pack.participaciones} ${unidad(pack.participaciones)}`;
      $('#sum-bici').textContent = bici ? bici.nombre : '—';
      $('#sum-total').textContent = total === pack.precio ? fmtARS(total) : `${fmtARS(total)} (antes ${fmtARS(pack.precio)})`;
      // Transferencia: los datos bancarios y el comprobante van dentro del mismo formulario.
      const box = $('#modal-transfer');
      if (box) {
        const on = medio === 'transferencia';
        box.hidden = !on;
        if (on) $('#modal-transfer-data').innerHTML = renderTransferData({ ...tr, monto: total, codigo: '' });
      }
      $('#btn-pagar').textContent = externo ? 'Comprar en la tienda' : medio === 'transferencia' ? 'Participar' : 'Ir a pagar con Mercado Pago';
      const secure = $('#modal-form .secure');
      if (secure) {
        const svg = secure.querySelector('svg');
        const texto =
          medio === 'transferencia'
            ? `Tus ${unidad(2)} se confirman al validar la transferencia · Recibís factura`
            : 'Pago seguro procesado por Mercado Pago · Recibís factura';
        secure.replaceChildren(...(svg ? [svg] : []), document.createTextNode(` ${texto}`));
      }
    }

    function open(packId) {
      formView.hidden = false;
      successView.hidden = true;
      if (packId) setPackGlobal(packId);
      setPack(state.pack);
      const activo = $('input[type="radio"]:checked', picker);
      if (activo) activo.closest('.ladder-item')?.scrollIntoView({ block: 'nearest' });
      $$('input[name="bici_preferida"]').forEach((r) => (r.checked = r.value === state.bici));
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      setTimeout(() => $('#f-nombre')?.focus(), 50);
    }
    function close() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    document.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-open-pack]');
      if (opener) {
        e.preventDefault();
        open(opener.dataset.openPack || null);
      }
      if (e.target.closest('[data-close-modal]') || e.target === modal) close();
    });
    document.addEventListener('keydown', (e) => e.key === 'Escape' && modal.classList.contains('is-open') && close());

    // Cambios en el pack desde el resumen deben reflejar la bici elegida en el radio.
    bikePicker.addEventListener('change', () => setPack(state.pack));

    const fileInput = $('#f-comprobante');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        $('#f-comprobante-nombre').textContent = fileInput.files[0] ? fileInput.files[0].name : 'Foto, captura o PDF del banco';
        fileInput.closest('.field')?.classList.remove('is-invalid');
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.classList.remove('is-visible');
      const data = collect(form);
      data.pack_id = state.pack;
      data.medio_pago = medioElegido();
      const errores = validate(data, cfg);
      paintErrors(form, errores);
      if (Object.keys(errores).length) {
        $('.is-invalid input, .is-invalid select', form)?.focus();
        return;
      }
      const btn = $('#btn-pagar');
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = 'Un segundo…';
      try {
        const pack = cfg.packs.find((p) => p.id === state.pack);
        if (cfg.checkout.modo === 'externo' && pack.url_externa) {
          location.href = pack.url_externa;
          return;
        }
        // Comprobante adjunto (transferencia): se convierte a base64 (imagen reducida o PDF).
        let comprobante = null;
        if (data.medio_pago === 'transferencia' && data.comprobante instanceof File && data.comprobante.size) {
          btn.textContent = 'Preparando el comprobante…';
          comprobante = await archivoABase64(data.comprobante);
        }
        delete data.comprobante;
        if (cfg.checkout.modo === 'api') {
          btn.textContent = comprobante ? 'Enviando…' : 'Un segundo…';
          const res = await fetch('api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(comprobante ? { ...data, comprobante } : data),
          });
          const out = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (out.errores) paintErrors(form, out.errores);
            throw new Error(out.error || 'No pudimos registrar tu participación.');
          }
          location.href = out.medio_pago === 'transferencia' ? `gracias.html?orden=${encodeURIComponent(out.orden_id)}` : out.init_point;
          return;
        }
        // Modo demo: simula la confirmación de pago (o la recepción del comprobante).
        await new Promise((r) => setTimeout(r, 700));
        const bici = cfg.bicis.find((b) => b.id === data.bici_preferida);
        if (data.medio_pago === 'transferencia') {
          showSuccess({
            nombre: data.nombre,
            pack,
            numeros: [],
            bici,
            transferencia: { ...tr, monto: totalPack(pack, 'transferencia'), codigo: '' },
            comprobante: Boolean(comprobante),
          });
          return;
        }
        const desde = 128 + Math.floor(Math.random() * 40);
        const numeros = Array.from({ length: pack.participaciones }, (_, i) => desde + i);
        showSuccess({ nombre: data.nombre, pack, numeros, bici });
      } catch (err) {
        errorBox.textContent = err.message || 'Algo salió mal. Probá de nuevo.';
        errorBox.classList.add('is-visible');
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });

    function showSuccess({ nombre, pack, numeros, bici, transferencia = null, comprobante = false }) {
      formView.hidden = true;
      successView.hidden = false;
      $('#ok-nombre').textContent = nombre;
      $('#ok-numeros').innerHTML = numeros.map((n) => `<li>${fmtNum(n)}</li>`).join('');
      $('#ok-bici').textContent = bici?.nombre || '';
      $('#ok-pack').textContent = `${nombrePack(pack)} + curso completo`;
      const texto = `¡Ya estoy participando por una ${bici?.nombre || 'Polygon'} con Baiking! 🚵 Mirá: ${location.href.split('#')[0]}`;
      $('#ok-share').href = `https://wa.me/?text=${encodeURIComponent(texto)}`;

      const transferBox = $('#ok-transfer');
      const titulo = $('#modal-success .modal-head h3');
      const sub = $('#modal-success .modal-head p');
      const eyebrow = $('#modal-success .modal-head .eyebrow');
      const plazo = transferencia?.plazo_horas || 48;
      if (eyebrow) eyebrow.textContent = comprobante ? 'Comprobante recibido' : transferencia ? 'Reserva confirmada' : 'Participación confirmada';
      if (transferencia && comprobante) {
        // Flujo principal: transfirió y adjuntó el comprobante en el mismo formulario.
        titulo.innerHTML = `¡Gracias, <span id="ok-nombre">${esc(nombre)}</span>!`;
        sub.textContent = `Recibimos tu comprobante. Validamos la transferencia y te mandamos por mail tus ${pack.participaciones} ${unidad(
          pack.participaciones,
        )} y el acceso al curso, en menos de ${plazo} hs.`;
        transferBox.hidden = true;
        $('#ok-ticket').hidden = true;
      } else if (transferencia) {
        titulo.innerHTML = `¡Reservamos tu lugar, <span id="ok-nombre">${esc(nombre)}</span>!`;
        sub.textContent = 'Te mandamos por mail los datos para transferir. Cuando subas el comprobante te asignamos tus chances.';
        $('#ok-transfer-data').innerHTML = renderTransferData(transferencia);
        $('#ok-transfer-note').textContent = `Transferí el monto exacto y subí el comprobante desde el link del mail o mandalo a ${transferencia.email_comprobantes}. Lo confirmamos en menos de ${plazo} hs.`;
        transferBox.hidden = false;
        $('#ok-ticket').hidden = true;
      } else {
        titulo.innerHTML = `¡Ya estás adentro, <span id="ok-nombre">${esc(nombre)}</span>!`;
        sub.textContent = 'Te mandamos el acceso al curso y tus participaciones por mail y WhatsApp.';
        transferBox.hidden = true;
        $('#ok-ticket').hidden = false;
      }
      successView.scrollIntoView({ block: 'nearest' });
    }
  }

  /* Datos de transferencia (dl) con botones de copiar. Se usa en el modal y en /gracias. */
  function renderTransferData(t) {
    const filas = [
      ['Monto', fmtARS(t.monto), true],
      ['Alias', t.alias],
      ['CBU', t.cbu],
      ['Titular', t.titular],
      ['CUIT', t.cuit],
      ['Banco', t.banco],
      ['Código', t.codigo, true],
    ].filter(([, v]) => v);
    // Datos bancarios todavía no confirmados: se muestran como "a confirmar", sin botón de copiar.
    return filas
      .map(([k, v, big]) =>
        pendiente(v)
          ? `<dt>${esc(k)}</dt><dd class="pendiente">a confirmar</dd><span></span>`
          : `<dt>${esc(k)}</dt><dd class="${big ? 'big' : ''}">${esc(v)}</dd><button type="button" class="copy" data-copy="${esc(v)}">Copiar</button>`,
      )
      .join('');
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const valor = b.dataset.copy;
    try {
      await navigator.clipboard.writeText(valor);
      b.textContent = 'Copiado';
    } catch {
      const r = document.createRange();
      r.selectNodeContents(b.previousElementSibling);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      b.textContent = 'Seleccionado';
    }
    setTimeout(() => (b.textContent = 'Copiar'), 1500);
  });
  /* Comprobante → base64: imágenes reducidas a 1600 px (JPEG); PDF hasta 3 MB. */
  async function archivoABase64(file) {
    if (file.type.startsWith('image/')) {
      const bitmap = await createImageBitmap(file).catch(() => {
        throw new Error('No pudimos abrir esa imagen. Probá con una captura de pantalla (JPG o PNG) o con el PDF del banco.');
      });
      const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * escala);
      canvas.height = Math.round(bitmap.height * escala);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      return { tipo: 'image/jpeg', nombre: file.name.replace(/\.[^.]+$/, '') + '.jpg', contenido_base64: dataUrl.split(',')[1] };
    }
    if (file.type === 'application/pdf') {
      if (file.size > 3 * 1024 * 1024) throw new Error('El PDF pesa más de 3 MB. Sacale una captura al comprobante y subila como imagen.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { tipo: 'application/pdf', nombre: file.name, contenido_base64: btoa(bin) };
    }
    throw new Error('Formato no soportado: subí una imagen (JPG, PNG) o un PDF.');
  }
  window.BaikingUI = { renderTransferData, fmtARS, archivoABase64 };

  function collect(form) {
    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) data[k] = typeof v === 'string' ? v.trim() : v;
    data.acepta_bases = fd.get('acepta_bases') === 'on';
    data.mayor_edad = fd.get('mayor_edad') === 'on';
    data.origen = 'web';
    return data;
  }

  function validate(d, cfg) {
    const e = {};
    if (!d.nombre || d.nombre.length < 2) e.nombre = 'Ingresá tu nombre.';
    if (!d.apellido || d.apellido.length < 2) e.apellido = 'Ingresá tu apellido.';
    const dni = String(d.dni || '').replace(/\D/g, '');
    if (dni.length < 7 || dni.length > 8) e.dni = 'DNI de 7 u 8 dígitos, sin puntos.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email || '')) e.email = 'Ingresá un email válido.';
    const tel = String(d.whatsapp || '').replace(/\D/g, '');
    if (tel.length < 10 || tel.length > 14) e.whatsapp = 'Con código de área, sin 0 ni 15. Ej: 11 5728 0056.';
    if (!d.provincia) e.provincia = 'Elegí tu provincia.';
    if (!cfg.bicis.some((b) => b.id === d.bici_preferida)) e.bici_preferida = 'Elegí una bici.';
    if (d.medio_pago && !['mercadopago', 'transferencia'].includes(d.medio_pago)) e.medio_pago = 'Elegí cómo querés pagar.';
    // Transferencia dentro del formulario: el comprobante es obligatorio.
    const box = $('#modal-transfer');
    if (d.medio_pago === 'transferencia' && box && !box.hidden) {
      const f = d.comprobante;
      if (!(f instanceof File) || !f.size) e.comprobante = 'Adjuntá el comprobante de la transferencia.';
      else if (f.size > 8 * 1024 * 1024) e.comprobante = 'El archivo pesa más de 8 MB. Probá con una captura de pantalla.';
      else if (!(f.type.startsWith('image/') || f.type === 'application/pdf')) e.comprobante = 'Subí una imagen (JPG, PNG) o un PDF.';
    }
    if (!d.mayor_edad) e.mayor_edad = 'Tenés que ser mayor de 18 años.';
    if (!d.acepta_bases) e.acepta_bases = 'Tenés que aceptar las bases y condiciones.';
    return e;
  }

  function paintErrors(form, errores) {
    $$('.field, .check', form).forEach((f) => f.classList.remove('is-invalid'));
    for (const [k, msg] of Object.entries(errores)) {
      const input = form.elements[k];
      const wrap = (input?.length ? input[0] : input)?.closest('.field, .check');
      if (!wrap) continue;
      wrap.classList.add('is-invalid');
      const err = $('.err', wrap);
      if (err) err.textContent = msg;
    }
  }

  /* ---------- participación sin cargo (página aparte) ---------- */
  function initFreeForm(cfg) {
    const form = $('#form-gratuita');
    if (!form) return;
    const provSel = $('#f-provincia', form);
    if (provSel) {
      provSel.innerHTML =
        `<option value="">Elegí tu provincia</option>` +
        PROVINCIAS.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    }
    const bikePicker = $('#bike-picker', form);
    bikePicker.innerHTML = cfg.bicis
      .map(
        (b) =>
          `<label><input type="radio" id="bici-free-${esc(b.id)}" name="bici_preferida" value="${esc(b.id)}" ${b.id === state.bici ? 'checked' : ''}>${esc(
            b.nombre.replace('Polygon ', ''),
          )}<span>${esc(b.tipo)}</span></label>`,
      )
      .join('');
    const errorBox = $('#form-error');
    const ok = $('#free-success');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.classList.remove('is-visible');
      const data = collect(form);
      data.website = form.elements.website?.value || '';
      const errores = validate(data, cfg);
      paintErrors(form, errores);
      if (Object.keys(errores).length) return;
      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      try {
        let numeros;
        if (cfg.checkout.modo === 'api') {
          const res = await fetch('api/participacion-gratuita', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const out = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (out.errores) paintErrors(form, out.errores);
            throw new Error(out.error || 'No pudimos registrar tu participación.');
          }
          numeros = out.numeros;
        } else {
          await new Promise((r) => setTimeout(r, 600));
          numeros = [301 + Math.floor(Math.random() * 60)];
        }
        form.hidden = true;
        ok.hidden = false;
        $('#ok-nombre').textContent = data.nombre;
        $('#ok-numeros').innerHTML = numeros.map((n) => `<li>${fmtNum(n)}</li>`).join('');
        $('#ok-bici').textContent = cfg.bicis.find((b) => b.id === data.bici_preferida)?.nombre || '';
        ok.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.add('is-visible');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---------- utilidades de página ---------- */
  function initMobileBar() {
    const bar = $('#mobile-bar');
    const hero = $('#hero');
    if (!bar || !hero) return;
    const io = new IntersectionObserver(([en]) => bar.classList.toggle('is-visible', !en.isIntersecting), { threshold: 0.05 });
    io.observe(hero);
  }

  /* Presencia en tiempo real (para el panel): un beacon al cargar y cada 30 s. */
  function initPresencia(cfg) {
    const activo = cfg.checkout?.modo === 'api' || cfg.panel?.presencia === true;
    if (!activo || !navigator.sendBeacon) return;
    const nuevoId = () =>
      (crypto.randomUUID && crypto.randomUUID()) || `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    let sid;
    try {
      sid = sessionStorage.getItem('bk_sid');
      if (!sid) {
        sid = nuevoId();
        sessionStorage.setItem('bk_sid', sid);
      }
    } catch {
      sid = nuevoId();
    }
    const ping = () => {
      if (document.visibilityState === 'hidden') return;
      const datos = new Blob([JSON.stringify({ sid, pagina: location.pathname })], { type: 'application/json' });
      navigator.sendBeacon('api/ping', datos);
    };
    ping();
    setInterval(ping, 30000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && ping());
  }

  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    setTimeout(() => el.classList.remove('is-visible'), 4200);
  }

  function initQueryFlags() {
    const q = new URLSearchParams(location.search);
    if (q.get('pago') === 'error') toast('El pago no se completó. Podés intentar de nuevo cuando quieras.');
  }

  /* ---------- bases y condiciones ---------- */
  function renderBases(cfg) {
    const packs = $('#bases-packs');
    if (packs) {
      packs.innerHTML = cfg.packs
        .map(
          (p) =>
            `<li><b>${esc(nombrePack(p))}</b> (${fmtARS(p.precio)}): ${esc((p.incluye || ['Curso online completo']).join('; '))}. Bonificación: ${p.participaciones} ${
              p.participaciones === 1 ? 'participación' : 'participaciones'
            }.</li>`,
        )
        .join('');
    }
    const bicis = $('#bases-bicis');
    if (bicis) {
      bicis.innerHTML = cfg.bicis
        .map(
          (b) =>
            `<li><b>${esc(b.nombre)}</b> (${esc(b.tipo)}), 0 km, valor de referencia ${
              typeof b.valor_referencia === 'number' ? fmtARS(b.valor_referencia) : '<mark>[A CONFIRMAR]</mark>'
            }.</li>`,
        )
        .join('');
    }
    const sec = $('#bases-secundarios');
    if (sec) {
      const secundarios = cfg.sorteo.premios_secundarios || [];
      sec.innerHTML = secundarios.map((p) => `<li><b>${esc(p.puesto)}:</b> ${esc(p.detalle)}.</li>`).join('');
      $('#bases-secundarios-block').hidden = secundarios.length === 0;
      const txt = $('#bases-adicionales-txt');
      if (txt) txt.hidden = secundarios.length === 0;
    }
    $$('[data-vigencia-desde]').forEach(
      (el) => (el.textContent = fmtFechaTexto(`${cfg.legal.vigencia_desde}T00:00:00-03:00`, true)),
    );
    $$('[data-gratuita-cantidad]').forEach((el) => (el.textContent = String(cfg.participacion_gratuita?.participaciones || 1)));
    $$('[data-sorteo-metodo]').forEach((el) => (el.textContent = cfg.sorteo.metodo));
    $$('[data-hoy]').forEach((el) => (el.textContent = cap(fmtFechaLarga(new Date().toISOString()))));
  }

  /* ---------- arranque ---------- */
  async function main() {
    await injectSprite();
    try {
      state.cfg = await loadConfig();
    } catch (err) {
      console.error(err);
      toast(err.message || 'No pudimos cargar la información de la campaña.');
      return;
    }
    const cfg = state.cfg;
    const guardada = store.get('baiking_bici');
    state.bici = cfg.bicis.some((b) => b.id === guardada) ? guardada : cfg.bicis[0].id;
    state.pack = (cfg.packs.find((p) => p.destacado) || cfg.packs[0]).id;

    const page = document.body.dataset.page;
    renderContact(cfg);
    renderCommon(cfg);
    initPresencia(cfg);
    if (page === 'home') {
      renderShopHero(cfg);
      renderBikes(cfg);
      renderCourse(cfg);
      renderPacks(cfg);
      renderDraw(cfg);
      renderFaq(cfg);
      initModal(cfg);
      initMobileBar();
      initQueryFlags();
      setBici(state.bici);
      setPackGlobal(state.pack);
    }
    if (page === 'gratuita') initFreeForm(cfg);
    if (page === 'bases') renderBases(cfg);
    document.documentElement.classList.add('is-ready');
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', main) : main();
})();
