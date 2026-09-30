/* Página /gracias: muestra el estado de una orden y sus participaciones.
   ?orden=<uuid>                  → consulta /api/orden
   ?demo=1                        → datos de ejemplo (pago aprobado)
   ?demo=1&transferencia=1        → datos de ejemplo (reserva por transferencia)     */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const TZ = 'America/Argentina/Buenos_Aires';
  const fmtNum = (n) => new Intl.NumberFormat('es-AR').format(Number(n));
  const fmtFecha = (iso) =>
    new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(iso));
  const fmtFechaHora = (iso) =>
    new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(iso));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const state = { demo: false, ordenId: null, campaign: null, poll: null };

  function show(id) {
    ['cargando', 'ok', 'pendiente', 'error', 'transferencia'].forEach((k) => ($(`#estado-${k}`).hidden = k !== id));
  }

  async function cfg() {
    if (window.__CAMPAIGN__) return window.__CAMPAIGN__;
    return (await fetch('config/campaign.json', { cache: 'no-cache' })).json();
  }

  async function obtener(id) {
    const res = await fetch(`api/orden?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  }

  /* Bloque de números ({ desde, hasta, cantidad }) como píldoras: "Del N.º 12.001 al N.º 22.000"
     + la cantidad; un solo número (vía gratuita): "N.º 1.587". */
  function pillsRango(rango, unidad) {
    if (!rango || !Number.isFinite(Number(rango.desde))) return '';
    const desde = Number(rango.desde);
    const hasta = Number(rango.hasta ?? rango.desde);
    const cantidad = Number(rango.cantidad ?? hasta - desde + 1);
    if (cantidad <= 1) return `<li>N.º ${fmtNum(desde)}</li>`;
    return `<li class="range">Del N.º ${fmtNum(desde)} al N.º ${fmtNum(hasta)}</li><li class="count">${fmtNum(cantidad)} ${esc(unidad?.plural || 'participaciones')}</li>`;
  }

  function renderOk(orden, campaign) {
    clearInterval(state.poll);
    const rango = orden.rango || null;
    $('#ok-nombre').textContent = orden.nombre;
    $('#ok-numeros').innerHTML = pillsRango(rango, campaign.unidad);
    $('#ok-titulo').textContent = Number(rango?.cantidad || 1) > 1 ? 'Tus participaciones' : 'Tu participación';
    $('#ok-bici').textContent = orden.bici?.nombre || '—';
    $('#ok-pack').textContent = orden.pack ? orden.pack.nombre : 'Participación sin cargo';
    $('#ok-sorteo').textContent = `${fmtFecha(campaign.edicion.fecha_sorteo)} hs`;
    $('#ok-orden').textContent = orden.id;
    // Link de entrega del producto (packs[].entrega_url; el curso cae a curso.url_acceso). Sin link: llega por mail.
    const curso = $('#ok-curso');
    const entrega = orden.pack?.entrega_url || (orden.pack?.id === 'curso' ? campaign.curso.url_acceso : '');
    if (orden.pack && entrega) {
      curso.href = entrega;
      curso.textContent = orden.pack.id === 'curso' ? 'Entrar al curso' : 'Descargar mi producto';
    } else curso.hidden = true;
    const texto = `¡Ya estoy participando por una ${orden.bici?.nombre || 'Polygon'} con Baiking! 🚵 Mirá: ${location.origin}${location.pathname.replace(/gracias(\.html)?$/, '')}`;
    $('#ok-share').href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    show('ok');
  }

  /* ---------- transferencia ---------- */
  function renderTransferencia(orden, campaign) {
    const t = { ...(orden.transferencia || campaign.checkout.transferencia || {}), monto: orden.monto, codigo: orden.codigo };
    $('#tr-nombre').textContent = orden.nombre;
    $('#tr-plazo').textContent = String(t.plazo_horas || 48);
    const cant = $('#tr-cantidad');
    if (cant) cant.textContent = orden.cantidad ? fmtNum(orden.cantidad) : '';
    $('#tr-data').innerHTML = window.BaikingUI.renderTransferData(t);
    $('#tr-note').textContent = `El monto tiene que ser exacto: ${window.BaikingUI.fmtARS(t.monto)}. Si tu banco pide un concepto, poné tu nombre y apellido.`;
    $('#tr-email').textContent = t.email_comprobantes || '';
    $('#tr-codigo').textContent = t.codigo || '';
    if (orden.estado === 'en_revision' && orden.comprobante_at) {
      $('#tr-recibido').hidden = false;
      $('#tr-recibido-fecha').textContent = fmtFechaHora(orden.comprobante_at);
      renderChecks(orden.comprobante_checks);
    }
    show('transferencia');
  }

  function renderChecks(checks) {
    const ul = $('#tr-checks');
    ul.replaceChildren();
    if (!checks) return;
    const filas = [
      ['monto_ok', 'El monto coincide', 'El monto no coincide con el de tu orden'],
      ['destino_ok', 'La cuenta destino es la de Baiking', 'No pudimos ver la cuenta destino (lo revisamos a mano)'],
    ];
    for (const [k, ok, bad] of filas) {
      const li = document.createElement('li');
      li.className = checks[k] ? 'ok' : 'bad';
      li.textContent = checks[k] ? ok : bad;
      ul.appendChild(li);
    }
  }

  async function archivoABase64(file) {
    if (file.type.startsWith('image/')) {
      // Reduce la imagen a 1600 px (JPEG) para que el envío pese menos de 1,5 MB.
      const bitmap = await createImageBitmap(file).catch(() => {
        throw new Error('No pudimos abrir esa imagen. Probá con una captura de pantalla (JPG o PNG) o con el PDF del banco.');
      });
      const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * escala);
      canvas.height = Math.round(bitmap.height * escala);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      return { tipo: 'image/jpeg', nombre: file.name.replace(/\.[^.]+$/, '') + '.jpg', contenido: dataUrl.split(',')[1] };
    }
    if (file.type === 'application/pdf') {
      if (file.size > 3 * 1024 * 1024) throw new Error('El PDF pesa más de 3 MB. Sacale una captura al comprobante y subila como imagen.');
      const buf = await file.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { tipo: 'application/pdf', nombre: file.name, contenido: btoa(bin) };
    }
    throw new Error('Formato no soportado: subí una imagen (JPG, PNG) o un PDF.');
  }

  function initUpload(campaign) {
    const form = $('#form-comprobante');
    const input = $('#f-comprobante');
    const err = $('#tr-error');
    const progress = $('#tr-progress');
    input.addEventListener('change', () => {
      $('#f-nombre-archivo').textContent = input.files[0] ? input.files[0].name : '';
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.classList.remove('is-visible');
      const file = input.files[0];
      if (!file) {
        err.textContent = 'Elegí el archivo del comprobante.';
        err.classList.add('is-visible');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        err.textContent = 'El archivo pesa más de 8 MB. Probá con una captura de pantalla.';
        err.classList.add('is-visible');
        return;
      }
      const btn = $('#btn-subir');
      btn.disabled = true;
      progress.hidden = false;
      progress.textContent = 'Preparando el archivo…';
      try {
        const archivo = await archivoABase64(file);
        progress.textContent = 'Subiendo y leyendo el comprobante…';
        let out;
        if (state.demo) {
          await new Promise((r) => setTimeout(r, 1200));
          out = { estado: 'en_revision', checks: { monto_ok: true, destino_ok: true, codigo_ok: false } };
        } else {
          const res = await fetch('api/comprobante', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orden_id: state.ordenId, tipo: archivo.tipo, nombre: archivo.nombre, contenido_base64: archivo.contenido }),
          });
          out = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(out.error || 'No pudimos subir el comprobante. Probá de nuevo o mandalo por mail.');
        }
        progress.hidden = true;
        if (out.estado === 'pagada') {
          const orden = state.demo ? null : await obtener(state.ordenId);
          if (orden && orden.rango) return renderOk(orden, campaign);
        }
        $('#tr-recibido').hidden = false;
        $('#tr-recibido-fecha').textContent = fmtFechaHora(new Date().toISOString());
        renderChecks(out.checks);
        $('#tr-recibido').scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!state.demo) iniciarPolling(campaign, 30000);
      } catch (e2) {
        progress.hidden = true;
        err.textContent = e2.message;
        err.classList.add('is-visible');
      } finally {
        btn.disabled = false;
      }
    });
  }

  function iniciarPolling(campaign, cada = 5000, maximo = 40) {
    clearInterval(state.poll);
    let intentos = 0;
    state.poll = setInterval(async () => {
      intentos += 1;
      const r = await obtener(state.ordenId).catch(() => null);
      if (r && r.estado === 'pagada' && r.rango) renderOk(r, campaign);
      if (intentos >= maximo) clearInterval(state.poll);
    }, cada);
  }

  async function main() {
    const q = new URLSearchParams(location.search);
    let campaign;
    try {
      campaign = await cfg();
    } catch {
      return show('error');
    }
    state.campaign = campaign;
    state.demo = q.get('demo') === '1';
    initUpload(campaign);

    if (state.demo) {
      const pack = campaign.packs.find((p) => p.destacado) || campaign.packs[0];
      if (q.get('transferencia') === '1') {
        const tr = campaign.checkout.transferencia || {};
        return renderTransferencia(
          { nombre: 'Delfina', estado: 'pendiente', medio_pago: 'transferencia', codigo: 'BK-7Q4M2', monto: Math.round(pack.precio * (1 - (tr.descuento_pct || 0) / 100)), cantidad: pack.participaciones, transferencia: tr },
          campaign,
        );
      }
      return renderOk(
        { id: 'demo-0000-0000', nombre: 'Delfina', rango: { desde: 12001, hasta: 12000 + pack.participaciones, cantidad: pack.participaciones }, bici: campaign.bicis[0], pack },
        campaign,
      );
    }

    const id = q.get('orden');
    if (!id) return show('error');
    state.ordenId = id;

    try {
      const orden = await obtener(id);
      if (!orden) return show('error');
      if (orden.estado === 'pagada' && orden.rango) return renderOk(orden, campaign);
      if (orden.medio_pago === 'transferencia' && ['pendiente', 'en_revision'].includes(orden.estado)) {
        renderTransferencia(orden, campaign);
        iniciarPolling(campaign, 30000, 120);
        return;
      }
      if (orden.carta?.requiere && orden.estado === 'pendiente') {
        // Participación sin cargo: los datos ya están; falta la carta a la tienda.
        $('#estado-pendiente .eyebrow').textContent = 'Datos registrados';
        $('#estado-pendiente h1').innerHTML = 'Ahora, <em>la carta</em>';
        $('#estado-pendiente .lead').textContent = `Mandanos una carta a ${orden.carta.direccion} (o dejala en la tienda) con tu nombre, DNI, mail y por qué deberías ganar la bici. Tenés tiempo hasta el ${fmtFechaHora(orden.carta.vence_at)}. Cuando la recibamos te confirmamos tu participación por mail.`;
        $('#estado-pendiente .callout').hidden = true;
        show('pendiente');
        iniciarPolling(campaign, 60000, 60);
        return;
      }
      if (orden.estado === 'pendiente') {
        show('pendiente');
        iniciarPolling(campaign, 5000, 40); // el webhook de Mercado Pago suele llegar en segundos
        return;
      }
      show('error');
    } catch {
      show('error');
    }
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', main) : main();
})();
