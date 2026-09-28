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
  const state = { cfg: null, bici: null, pack: null };

  function setBici(id, { scrollToPacks = false } = {}) {
    if (!state.cfg.bicis.some((b) => b.id === id)) return;
    state.bici = id;
    store.set('baiking_bici', id);
    $$('.bike-card').forEach((c) => c.classList.toggle('is-selected', c.dataset.bici === id));
    $$('.bike-card .btn-select').forEach((b) => {
      const sel = b.closest('.bike-card').dataset.bici === id;
      b.textContent = sel ? 'Elegida ✓' : 'Quiero esta';
    });
    $$('.prize-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bici === id)));
    renderPrizeArt();
    $$('input[name="bici_preferida"]').forEach((r) => (r.checked = r.value === id));
    if (scrollToPacks) $('#packs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- hero ---------- */
  function renderPrizeArt() {
    const bici = state.cfg.bicis.find((b) => b.id === state.bici) || state.cfg.bicis[0];
    const art = $('#prize-art');
    if (!art) return;
    art.classList.toggle('is-gravel', bici.ilustracion === 'gravel');
    art.innerHTML = bici.imagen
      ? `<img src="${esc(bici.imagen)}" alt="${esc(bici.nombre)}">`
      : `<svg viewBox="0 0 400 240" role="img" aria-label="${esc(bici.nombre)}"><use href="#art-${esc(bici.ilustracion)}"></use></svg>`;
    $('#prize-name').textContent = bici.nombre;
    $('#prize-type').textContent = bici.tipo;
  }

  /* Textos comunes a todas las páginas (fechas, Instagram, seguidores). */
  function renderCommon(cfg) {
    const { edicion } = cfg;
    const fecha = cap(fmtFechaLarga(edicion.fecha_sorteo));
    $$('[data-fecha-sorteo]').forEach((el) => (el.textContent = fecha));
    $$('[data-fecha-sorteo-corta]').forEach((el) => (el.textContent = fmtCorta(edicion.fecha_sorteo)));
    $$('[data-hora-sorteo]').forEach((el) => (el.textContent = `${fmtHora(edicion.fecha_sorteo)} hs`));
    $$('[data-cierre]').forEach(
      (el) => (el.textContent = `${fmtFechaLarga(edicion.cierre_ventas)} a las ${fmtHora(edicion.cierre_ventas)} hs`),
    );
    $$('[data-instagram]').forEach((el) => (el.textContent = `@${cfg.contacto.instagram}`));
    $$('[data-seguidores]').forEach((el) => (el.textContent = cfg.marca.seguidores_instagram || ''));
    const badge = $('#badge-text');
    if (badge) {
      badge.textContent = `${edicion.nombre} · Sorteo en vivo el ${fmtFechaLarga(edicion.fecha_sorteo).replace(/^\w+,?\s*/, '')}`;
    }
  }

  function renderHero(cfg) {
    const { edicion } = cfg;
    const sw = $('#prize-switch');
    if (sw) {
      sw.innerHTML = cfg.bicis
        .map(
          (b) =>
            `<button type="button" data-bici="${esc(b.id)}" aria-pressed="false">${esc(b.nombre.replace('Polygon ', ''))}</button>`,
        )
        .join('');
      sw.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-bici]');
        if (btn) setBici(btn.dataset.bici);
      });
    }
    initCountdown(edicion.fecha_sorteo);
  }

  function initCountdown(iso) {
    const el = $('#countdown');
    if (!el) return;
    const target = new Date(iso).getTime();
    const cells = ['d', 'h', 'm', 's'].map((k) => $(`[data-cd="${k}"]`, el));
    const tick = () => {
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 864e5);
      diff -= d * 864e5;
      const h = Math.floor(diff / 36e5);
      diff -= h * 36e5;
      const m = Math.floor(diff / 6e4);
      const s = Math.floor((diff - m * 6e4) / 1e3);
      [d, h, m, s].forEach((v, i) => cells[i] && (cells[i].textContent = String(v).padStart(2, '0')));
    };
    tick();
    setInterval(tick, 1000);
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
  }

  /* ---------- curso ---------- */
  function renderCourse(cfg) {
    const { curso } = cfg;
    $$('[data-curso-nombre]').forEach((el) => (el.textContent = curso.nombre));
    $$('[data-curso-descripcion]').forEach((el) => (el.textContent = curso.descripcion));
    $$('[data-curso-docente]').forEach((el) => (el.textContent = curso.docente));
    const fmt = $('#course-format');
    if (fmt) {
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
          <div><h4>${esc(m.titulo)}</h4><p>${esc(m.descripcion)}</p></div>
          <span class="dur">${esc(m.duracion)}</span>
        </li>`,
        )
        .join('');
    }
  }

  /* ---------- packs ---------- */
  function renderPacks(cfg) {
    const wrap = $('#packs-grid');
    if (!wrap) return;
    wrap.innerHTML = cfg.packs
      .map((p) => {
        const porPart = Math.round(p.precio / p.participaciones);
        return `
        <article class="pack reveal ${p.destacado ? 'is-featured' : ''}" data-pack="${esc(p.id)}">
          ${p.etiqueta ? `<span class="ribbon">${esc(p.etiqueta)}</span>` : ''}
          <div class="qty">${p.participaciones}<small>${p.participaciones === 1 ? 'participación' : 'participaciones'} · ${esc(p.nombre)}</small></div>
          <div class="price">${fmtARS(p.precio)}<span>${p.participaciones > 1 ? `equivale a ${fmtARS(porPart)} por participación` : 'precio del curso'}</span></div>
          <ul>${(p.incluye || []).map((t) => `<li>${icon('ico-check')}<span>${esc(t)}</span></li>`).join('')}</ul>
          <button type="button" class="btn ${p.destacado ? 'btn-primary' : 'btn-ghost'}" data-open-pack="${esc(p.id)}">Elegir ${esc(p.nombre)}</button>
        </article>`;
      })
      .join('');
    const feat = cfg.packs.find((p) => p.destacado) || cfg.packs[0];
    const mb = $('#mobile-bar-info');
    if (mb) mb.innerHTML = `${esc(feat.nombre)} · ${fmtARS(feat.precio)}<b>${feat.participaciones} participaciones</b>`;
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
    $$('[data-email]').forEach((el) => {
      el.textContent = contacto.email;
      if (el.tagName === 'A') el.href = `mailto:${contacto.email}`;
    });
    $$('[data-web]').forEach((el) => {
      el.textContent = marca.web.replace(/^https?:\/\//, '');
      if (el.tagName === 'A') el.href = marca.web;
    });
    $$('[data-legal-leyenda]').forEach((el) => (el.textContent = legal.leyenda));
    $$('[data-legal-aviso]').forEach((el) => (el.textContent = legal.aviso_corto));
    $$('[data-legal-organizador]').forEach(
      (el) => (el.textContent = `${legal.razon_social} · CUIT ${legal.cuit} · ${legal.domicilio}`),
    );
    $$('[data-gratuita-texto]').forEach((el) => (el.textContent = cfg.participacion_gratuita?.texto || ''));
    const foto = $('#about-photo');
    if (foto && marca.foto_gaston) {
      foto.innerHTML = `<img src="${esc(marca.foto_gaston)}" alt="${esc(marca.foto_gaston_alt || '')}" loading="lazy">`;
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

    picker.innerHTML = cfg.packs
      .map(
        (p) =>
          `<button type="button" data-pack="${esc(p.id)}" aria-pressed="false"><b>${p.participaciones}</b>${esc(p.nombre)}</button>`,
      )
      .join('');
    picker.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-pack]');
      if (b) setPack(b.dataset.pack);
    });

    bikePicker.innerHTML = cfg.bicis
      .map(
        (b) => `
        <label><input type="radio" id="bici-${esc(b.id)}" name="bici_preferida" value="${esc(b.id)}">${esc(b.nombre.replace('Polygon ', ''))}<span>${esc(b.tipo)}</span></label>`,
      )
      .join('');
    bikePicker.addEventListener('change', (e) => {
      if (e.target.name === 'bici_preferida') setBici(e.target.value);
    });

    // Medio de pago (transferencia opcional, configurable en checkout.transferencia)
    const tr = cfg.checkout.transferencia;
    const transferenciaOn = Boolean(tr && tr.habilitada) && cfg.checkout.modo !== 'externo';
    const payPicker = $('#pay-picker');
    if (transferenciaOn) {
      $('#pago-field').hidden = false;
      payPicker.innerHTML = `
        <label><input type="radio" id="pago-mp" name="medio_pago" value="mercadopago" checked>Mercado Pago<span>Tarjeta de crédito, débito o dinero en cuenta. Confirmación al instante.</span></label>
        <label><input type="radio" id="pago-tr" name="medio_pago" value="transferencia">Transferencia bancaria ${
          tr.descuento_pct ? `<em>${esc(String(tr.descuento_pct))} % de descuento</em>` : ''
        }<span>Te damos el alias y un código, subís el comprobante y lo confirmamos en menos de ${esc(String(tr.plazo_horas || 48))} hs.</span></label>`;
      payPicker.addEventListener('change', () => setPack(state.pack));
    }
    const medioElegido = () => (transferenciaOn && form.elements.medio_pago?.value) || 'mercadopago';
    const totalPack = (pack, medio) =>
      medio === 'transferencia' && tr?.descuento_pct ? Math.round(pack.precio * (1 - tr.descuento_pct / 100)) : pack.precio;

    function setPack(id) {
      const pack = cfg.packs.find((p) => p.id === id) || cfg.packs.find((p) => p.destacado) || cfg.packs[0];
      state.pack = pack.id;
      $$('button[data-pack]', picker).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pack === pack.id)));
      const bici = cfg.bicis.find((b) => b.id === state.bici);
      const medio = medioElegido();
      const total = totalPack(pack, medio);
      $('#sum-pack').textContent = `${pack.nombre}`;
      $('#sum-part').textContent = `${pack.participaciones} ${pack.participaciones === 1 ? 'participación' : 'participaciones'}`;
      $('#sum-bici').textContent = bici ? bici.nombre : '—';
      $('#sum-total').textContent = total === pack.precio ? fmtARS(total) : `${fmtARS(total)} (antes ${fmtARS(pack.precio)})`;
      $('#btn-pagar').textContent =
        cfg.checkout.modo === 'externo'
          ? 'Comprar en la tienda'
          : medio === 'transferencia'
            ? 'Confirmar y ver datos para transferir'
            : 'Ir a pagar con Mercado Pago';
      const secure = $('#modal-form .secure');
      if (secure) {
        secure.lastChild.textContent =
          medio === 'transferencia'
            ? ' Sin comisiones · Recibís factura al acreditarse la transferencia'
            : ' Pago seguro procesado por Mercado Pago · Recibís factura';
      }
    }

    function open(packId) {
      formView.hidden = false;
      successView.hidden = true;
      setPack(packId);
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
        if (cfg.checkout.modo === 'api') {
          const res = await fetch('api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const out = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (out.errores) paintErrors(form, out.errores);
            throw new Error(out.error || 'No pudimos iniciar el pago.');
          }
          location.href = out.medio_pago === 'transferencia' ? `gracias.html?orden=${encodeURIComponent(out.orden_id)}` : out.init_point;
          return;
        }
        // Modo demo: simula la confirmación de pago (o la reserva por transferencia).
        await new Promise((r) => setTimeout(r, 700));
        const bici = cfg.bicis.find((b) => b.id === data.bici_preferida);
        if (data.medio_pago === 'transferencia') {
          showSuccess({
            nombre: data.nombre,
            pack,
            numeros: [],
            bici,
            transferencia: { ...tr, monto: totalPack(pack, 'transferencia'), codigo: `BK-${Math.random().toString(36).slice(2, 7).toUpperCase()}` },
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

    function showSuccess({ nombre, pack, numeros, bici, transferencia = null }) {
      formView.hidden = true;
      successView.hidden = false;
      $('#ok-nombre').textContent = nombre;
      $('#ok-numeros').innerHTML = numeros.map((n) => `<li>${fmtNum(n)}</li>`).join('');
      $('#ok-bici').textContent = bici?.nombre || '';
      $('#ok-pack').textContent = `${pack.nombre} · ${pack.participaciones} ${pack.participaciones === 1 ? 'participación' : 'participaciones'}`;
      const texto = `¡Ya estoy participando por una ${bici?.nombre || 'Polygon'} con Baiking! 🚵 Mirá: ${location.href.split('#')[0]}`;
      $('#ok-share').href = `https://wa.me/?text=${encodeURIComponent(texto)}`;

      const transferBox = $('#ok-transfer');
      const titulo = $('#modal-success .modal-head h3');
      const sub = $('#modal-success .modal-head p');
      const eyebrow = $('#modal-success .modal-head .eyebrow');
      if (eyebrow) eyebrow.textContent = transferencia ? 'Reserva confirmada' : 'Participación confirmada';
      if (transferencia) {
        titulo.innerHTML = `¡Reservamos tu lugar, <span id="ok-nombre">${esc(nombre)}</span>!`;
        sub.textContent = 'Te mandamos por mail los datos para transferir. Cuando subas el comprobante te asignamos tus participaciones.';
        $('#ok-transfer-data').innerHTML = renderTransferData(transferencia);
        $('#ok-transfer-note').textContent = `Transferí el monto exacto y poné el código en el concepto. Después subí el comprobante desde el link del mail o mandalo a ${transferencia.email_comprobantes}. Lo confirmamos en menos de ${transferencia.plazo_horas || 48} hs.`;
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
    return filas
      .map(
        ([k, v, big]) =>
          `<dt>${esc(k)}</dt><dd class="${big ? 'big' : ''}">${esc(v)}</dd><button type="button" class="copy" data-copy="${esc(v)}">Copiar</button>`,
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
  window.BaikingUI = { renderTransferData, fmtARS };

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
            `<li><b>${esc(p.nombre)}</b> (${fmtARS(p.precio)}): ${esc((p.incluye || []).join('; '))}. Bonificación: ${p.participaciones} ${
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
      (el) => (el.textContent = cap(fmtFechaLarga(`${cfg.legal.vigencia_desde}T00:00:00-03:00`))),
    );
    $$('[data-edicion-nombre]').forEach((el) => (el.textContent = cfg.edicion.nombre));
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
    state.bici = store.get('baiking_bici') || cfg.bicis[0].id;
    state.pack = (cfg.packs.find((p) => p.destacado) || cfg.packs[0]).id;

    const page = document.body.dataset.page;
    renderContact(cfg);
    renderCommon(cfg);
    initPresencia(cfg);
    if (page === 'home') {
      renderHero(cfg);
      renderBikes(cfg);
      renderCourse(cfg);
      renderPacks(cfg);
      renderDraw(cfg);
      renderFaq(cfg);
      initModal(cfg);
      initMobileBar();
      initQueryFlags();
      setBici(state.bici);
    }
    if (page === 'gratuita') initFreeForm(cfg);
    if (page === 'bases') renderBases(cfg);
    document.documentElement.classList.add('is-ready');
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', main) : main();
})();
