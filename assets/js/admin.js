/* ============================================================
   Panel de administración — lógica
   Fuente de datos: GET api/admin con el token en el header
   Authorization: Bearer <token> (nunca en la URL: quedaría en logs e
   historial). Datos de ejemplo con ?demo=1.
   Filtros (rango, estado) recortan todo lo que está debajo.
   Gráficos en SVG con tooltip y tabla gemela.
   ============================================================ */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const TZ = 'America/Argentina/Buenos_Aires';
  const DIA = 864e5;

  const fmtInt = (n) => new Intl.NumberFormat('es-AR').format(Math.round(n));
  const fmtARS = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const fmtCompact = (n) => {
    if (Math.abs(n) >= 1e6) return `$ ${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
    if (Math.abs(n) >= 1e3) return `$ ${(n / 1e3).toLocaleString('es-AR', { maximumFractionDigits: 0 })} mil`;
    return fmtARS(n);
  };
  const fmtFechaHora = (iso) =>
    new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(iso));
  const fmtDia = (iso) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', timeZone: TZ }).format(new Date(iso));
  const fmtDiaLargo = (iso) => new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso));
  const claveDia = (iso) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(new Date(iso)); // YYYY-MM-DD

  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
    del(k) { try { sessionStorage.removeItem(k); } catch {} },
  };

  const state = { token: null, demo: false, data: null, rango: '30', estado: 'pagadas', q: '', timer: null };

  // Token del panel: siempre en el header Authorization (nunca en la query string).
  const authHeaders = () => ({ Authorization: `Bearer ${state.token || ''}` });

  // Números de una orden para los avisos: lista si son pocos, rango si son muchos y consecutivos
  // (los packs grandes asignan un bloque correlativo: "del 0101 al 0200").
  const fmtNumero = (n) => String(n).padStart(4, '0');
  function resumirNumeros(numeros) {
    const lista = (numeros || []).map(Number);
    if (!lista.length) return '—';
    const consecutivos = lista.every((v, i) => i === 0 || v === lista[i - 1] + 1);
    if (lista.length > 12 && consecutivos) return `del ${fmtNumero(lista[0])} al ${fmtNumero(lista[lista.length - 1])} (${fmtInt(lista.length)})`;
    return lista.map(fmtNumero).join(', ');
  }

  /* ---------- helpers SVG ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs = {}, parent) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    if (parent) parent.appendChild(el);
    return el;
  }
  function texto(parent, x, y, contenido, attrs = {}) {
    const t = svg('text', { x, y, ...attrs }, parent);
    t.textContent = contenido;
    return t;
  }
  // Columna con extremo redondeado (4px) y base cuadrada.
  function columna(x, y, w, h, r = 4) {
    if (h <= 0) return `M${x},${y}h${w}v0h${-w}z`;
    const rr = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
  }
  // Barra horizontal con extremo derecho redondeado.
  function barra(x, y, w, h, r = 4) {
    if (w <= 0) return `M${x},${y}v${h}h0v${-h}z`;
    const rr = Math.min(r, h / 2, w);
    return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
  }
  function ticksBonitos(max, cantidad = 4) {
    if (max <= 0) return [0, 1];
    const bruto = max / cantidad;
    const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
    const paso = [1, 2, 5, 10].map((m) => m * pot).find((p) => p >= bruto);
    const ticks = [];
    for (let v = 0; v <= max + paso * 0.999; v += paso) ticks.push(v);
    return ticks;
  }

  /* ---------- tooltip ---------- */
  const tip = $('#viz-tip');
  function mostrarTip(ev, filas) {
    tip.replaceChildren();
    for (const f of filas) {
      if (f.titulo) {
        const d = document.createElement('div');
        d.textContent = f.titulo;
        tip.appendChild(d);
        continue;
      }
      const row = document.createElement('div');
      const k = document.createElement('span');
      k.className = 'k';
      k.textContent = f.k;
      const b = document.createElement('b');
      b.textContent = f.v;
      row.append(b, k);
      tip.appendChild(row);
    }
    tip.hidden = false;
    moverTip(ev);
  }
  function moverTip(ev) {
    const x = (ev.clientX ?? 0) + 14;
    const y = (ev.clientY ?? 0) + 14;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(x, window.innerWidth - r.width - 12)}px`;
    tip.style.top = `${Math.min(y, window.innerHeight - r.height - 12)}px`;
  }
  function ocultarTip() {
    tip.hidden = true;
  }
  function conTip(el, filas) {
    el.addEventListener('pointerenter', (e) => mostrarTip(e, filas()));
    el.addEventListener('pointermove', moverTip);
    el.addEventListener('pointerleave', ocultarTip);
    el.addEventListener('focus', () => {
      const r = el.getBoundingClientRect();
      mostrarTip({ clientX: r.left + r.width / 2, clientY: r.top }, filas());
    });
    el.addEventListener('blur', ocultarTip);
  }

  /* ---------- datos de ejemplo (demo) ---------- */
  function rng(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function datosDemo(cfg) {
    const r = rng(20261204);
    const nombres = ['Juan', 'Sofía', 'Martín', 'Lucía', 'Nicolás', 'Camila', 'Federico', 'Valentina', 'Gonzalo', 'Julieta', 'Agustín', 'Florencia', 'Tomás', 'Carolina', 'Matías', 'Micaela'];
    const apellidos = ['Pérez', 'Gómez', 'Rodríguez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Sosa', 'Romero', 'Álvarez', 'Torres', 'Ruiz', 'Benítez', 'Acosta'];
    const provs = ['Buenos Aires', 'Buenos Aires', 'Buenos Aires', 'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Córdoba', 'Santa Fe', 'Mendoza', 'Entre Ríos', 'Tucumán', 'Neuquén'];
    const packs = cfg.packs;
    const ordenes = [];
    const hoy = new Date();
    let n = 1;
    for (let d = 41; d >= 0; d--) {
      const fecha = new Date(hoy.getTime() - d * DIA);
      const base = 3 + Math.round((41 - d) * 0.45) + (fecha.getDay() === 6 ? 4 : 0);
      const cant = Math.max(1, Math.round(base * (0.6 + r() * 0.8)));
      for (let i = 0; i < cant; i++) {
        const u = r();
        const pack = packs[Math.min(packs.length - 1, u < 0.35 ? 0 : u < 0.55 ? 1 : u < 0.7 ? 2 : u < 0.8 ? 3 : u < 0.92 ? 4 : u < 0.97 ? 5 : 7)];
        const gratuita = r() < 0.12;
        // Con Mercado Pago desactivado en la config, la demo muestra solo transferencias.
        const mpOn = cfg.checkout?.mercadopago ? cfg.checkout.mercadopago.habilitada !== false : true;
        const medio = gratuita ? 'gratuita' : mpOn && r() < 0.78 ? 'mercadopago' : 'transferencia';
        const t = new Date(fecha.getTime() - r() * 14 * 36e5 - 6 * 36e5);
        const e = r();
        let estado = 'pagada';
        if (gratuita) estado = d <= 5 && e < 0.6 ? 'pendiente' : 'pagada'; // en dos pasos: las recientes esperan la carta
        else if (medio === 'transferencia') estado = d === 0 && e < 0.5 ? 'en_revision' : e < 0.08 ? 'pendiente' : 'pagada';
        else estado = e < 0.06 ? 'pendiente' : e < 0.08 ? 'rechazada' : 'pagada';
        const nombre = nombres[Math.floor(r() * nombres.length)];
        const apellido = apellidos[Math.floor(r() * apellidos.length)];
        // Conciliación bancaria (solo transferencias con comprobante): null = sin revisar, true = llegó, false = no llegó.
        const conComprobante = medio === 'transferencia' && estado !== 'pendiente';
        const a = r();
        const acreditada = !conComprobante ? null : estado === 'pagada' ? (a < 0.7 ? true : a < 0.92 ? null : false) : a < 0.15 ? false : null;
        ordenes.push({
          id: `demo-${String(n).padStart(4, '0')}`,
          created_at: t.toISOString(),
          pagada_at: estado === 'pagada' ? new Date(t.getTime() + 5 * 6e4).toISOString() : null,
          comprobante_at: conComprobante ? new Date(t.getTime() + 2 * 6e4).toISOString() : null,
          comprobante_url: conComprobante ? `demo/${n}.jpg` : null,
          acreditada,
          acreditada_at: acreditada === null ? null : new Date(t.getTime() + 6 * 36e5).toISOString(),
          acreditada_nota: acreditada === false ? 'No figura en el extracto' : null,
          carta_recibida_at: gratuita && estado === 'pagada' ? new Date(t.getTime() + 3 * DIA).toISOString() : null,
          estado,
          origen: gratuita ? 'gratuita' : 'web',
          medio_pago: medio,
          pack_id: gratuita ? 'gratuita' : pack.id,
          cantidad_participaciones: gratuita ? 1 : pack.participaciones,
          monto: gratuita ? 0 : pack.precio,
          bici_preferida: (cfg.bicis[Math.floor(r() * cfg.bicis.length)] || cfg.bicis[0]).id,
          provincia: provs[Math.floor(r() * provs.length)],
          nombre,
          apellido,
          email: `${nombre.toLowerCase()}.${apellido.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@ejemplo.com`,
          dni: String(20000000 + Math.floor(r() * 25000000)),
          codigo: medio === 'transferencia' ? `BK-${Math.floor(r() * 36 ** 5).toString(36).toUpperCase().padStart(5, '0')}` : null,
          comprobante_datos:
            estado === 'en_revision'
              ? { monto_leido: r() < 0.8 ? pack.precio : pack.precio - 5000, fecha_leida: t.toISOString().slice(0, 10), destino_ok: r() < 0.9, codigo_ok: r() < 0.7 }
              : null,
        });
        n += 1;
      }
    }
    ordenes.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const asignadas = ordenes.filter((o) => o.estado === 'pagada').reduce((s, o) => s + o.cantidad_participaciones, 0);
    return {
      generado_at: new Date().toISOString(),
      edicion: cfg.edicion,
      unidad: cfg.unidad,
      packs: cfg.packs,
      bicis: cfg.bicis.map((b) => ({ id: b.id, nombre: b.nombre })),
      presencia: { ahora: 4 + Math.floor(r() * 9), hoy: 180 + Math.floor(r() * 120) },
      participaciones_total: asignadas,
      cupo_total: Number(cfg.edicion.cupo_total || 0),
      participacion_gratuita: cfg.participacion_gratuita || {},
      ordenes,
    };
  }

  /* ---------- carga ---------- */
  async function cargar({ silencioso = false } = {}) {
    const root = $('#panel');
    if (state.demo) {
      const cfg = window.__CAMPAIGN__ || (await (await fetch('config/campaign.json', { cache: 'no-cache' })).json());
      state.data = datosDemo(cfg);
      render();
      return;
    }
    if (!silencioso) root.classList.add('is-refreshing');
    try {
      const res = await fetch('api/admin', { cache: 'no-store', headers: authHeaders() });
      if (res.status === 401) {
        store.del('bk_admin_token');
        state.token = null;
        mostrarLogin('Token incorrecto.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      render();
    } catch (err) {
      console.error(err);
      toast('No pudimos actualizar los datos. Reintentamos en 20 s.');
    } finally {
      root.classList.remove('is-refreshing');
    }
  }

  /* ---------- filtros ---------- */
  function desdeRango() {
    const hoy = new Date();
    const inicioHoy = new Date(claveDia(hoy.toISOString()) + 'T00:00:00-03:00').getTime();
    if (state.rango === 'hoy') return inicioHoy;
    if (state.rango === '7') return inicioHoy - 6 * DIA;
    if (state.rango === '30') return inicioHoy - 29 * DIA;
    return 0;
  }
  // Transferencias que entran en la conciliación diaria contra el banco: con comprobante y no cerradas.
  const ESTADOS_CONCILIABLES = ['pendiente', 'en_revision', 'pagada'];
  const esConciliable = (o) => o.medio_pago === 'transferencia' && Boolean(o.comprobante_at) && ESTADOS_CONCILIABLES.includes(o.estado);
  const sinConciliar = (o) => esConciliable(o) && o.acreditada == null;

  function filtradas() {
    const desde = desdeRango();
    return state.data.ordenes.filter((o) => {
      const t = new Date(o.created_at).getTime();
      if (t < desde) return false;
      if (state.estado === 'pagadas' && o.estado !== 'pagada') return false;
      if (state.estado === 'sin_conciliar' && !sinConciliar(o)) return false;
      return true;
    });
  }

  function setEstadoFiltro(valor) {
    state.estado = valor;
    $$('#filtro-estado button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.estado === valor)));
    if (state.data) render();
  }

  /* ---------- render ---------- */
  function render() {
    const d = state.data;
    const packsPorId = Object.fromEntries(d.packs.map((p) => [p.id, p]));
    const bicisPorId = Object.fromEntries(d.bicis.map((b) => [b.id, b]));
    const filas = filtradas();
    const pagadas = filas.filter((o) => o.estado === 'pagada');
    const compras = pagadas.filter((o) => o.medio_pago !== 'gratuita');
    const gratuitas = pagadas.filter((o) => o.medio_pago === 'gratuita');
    const hoyClave = claveDia(new Date().toISOString());
    const ayerClave = claveDia(new Date(Date.now() - DIA).toISOString());
    const todasPagadas = d.ordenes.filter((o) => o.estado === 'pagada');
    const partHoy = todasPagadas.filter((o) => claveDia(o.pagada_at || o.created_at) === hoyClave).reduce((s, o) => s + o.cantidad_participaciones, 0);
    const partAyer = todasPagadas.filter((o) => claveDia(o.pagada_at || o.created_at) === ayerClave).reduce((s, o) => s + o.cantidad_participaciones, 0);
    const ordenesHoy = todasPagadas.filter((o) => o.medio_pago !== 'gratuita' && claveDia(o.pagada_at || o.created_at) === hoyClave).length;

    const plural = d.unidad?.plural || 'participaciones';
    const Plural = plural.charAt(0).toUpperCase() + plural.slice(1);
    $('.tile-hero .tile-label').textContent = `${Plural} asignadas`;
    $('#kpi-gratuitas').previousElementSibling.textContent = `${Plural} sin cargo`;
    $('#card-dias h2').textContent = `${Plural} por día`;
    $('#edicion-nombre').textContent = `${d.edicion.nombre} · Sorteo ${fmtDiaLargo(d.edicion.fecha_sorteo)}`;
    $('#meta-actualizado').textContent = `Actualizado ${new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: TZ }).format(new Date(d.generado_at))} hs · ${state.demo ? 'datos de ejemplo' : 'se actualiza cada 20 s'}`;

    // KPIs (el rango recorta los KPIs de actividad; el total de participaciones es global)
    const partFiltro = pagadas.reduce((s, o) => s + o.cantidad_participaciones, 0);
    $('#kpi-participaciones').textContent = fmtInt(state.rango === 'todo' ? d.participaciones_total : partFiltro);
    const delta = partHoy - partAyer;
    const kd = $('#kpi-participaciones-delta');
    const cupoTxt = d.cupo_total ? ` · ${Math.round((d.participaciones_total / d.cupo_total) * 100)} % del cupo de ${fmtInt(d.cupo_total)}` : '';
    kd.textContent = `${partHoy > 0 ? `+${fmtInt(partHoy)} hoy` : 'Sin asignaciones hoy'}${partAyer ? ` · ${delta >= 0 ? '+' : ''}${fmtInt(delta)} vs. ayer` : ''}${cupoTxt}`;
    kd.classList.toggle('up', delta > 0);
    $('#kpi-ordenes').textContent = fmtInt(compras.length);
    $('#kpi-ordenes-delta').textContent = ordenesHoy ? `+${fmtInt(ordenesHoy)} hoy` : '';
    const ingresos = compras.reduce((s, o) => s + Number(o.monto || 0), 0);
    $('#kpi-ingresos').textContent = fmtCompact(ingresos);
    $('#kpi-ticket').textContent = compras.length ? `ticket promedio ${fmtARS(ingresos / compras.length)}` : '';
    const pendientes = d.ordenes.filter((o) => o.estado === 'pendiente' && o.medio_pago !== 'gratuita');
    const enRevision = d.ordenes.filter((o) => o.estado === 'en_revision');
    $('#kpi-pendientes').textContent = fmtInt(pendientes.length + enRevision.length);
    $('#kpi-revision').textContent = enRevision.length ? `${fmtInt(enRevision.length)} transferencias por revisar` : 'nada por revisar';
    $('#kpi-gratuitas').textContent = fmtInt(gratuitas.length);
    $('#kpi-gratuitas-pct').textContent = partFiltro ? `${Math.round((gratuitas.length / partFiltro) * 100)} % de las participaciones` : '';
    $('#kpi-online').textContent = fmtInt(d.presencia.ahora);
    $('#kpi-online-nav').textContent = fmtInt(d.presencia.ahora);
    $('#kpi-visitas').textContent = `${fmtInt(d.presencia.hoy)} visitas hoy`;

    // Conciliación contra el banco (misma regla que el backend; se recalcula acá para la demo).
    const sinConc = d.ordenes.filter(sinConciliar).length;
    const noLlego = d.ordenes.filter((o) => o.medio_pago === 'transferencia' && o.acreditada === false).length;
    $('#kpi-conciliar').textContent = fmtInt(sinConc);
    $('#kpi-conciliar-delta').textContent = noLlego ? `${fmtInt(noLlego)} marcadas "no llegó"` : sinConc ? 'transferencias por revisar en el banco' : 'todo conciliado';

    // Sparkline: últimos 14 días de participaciones (de-énfasis; hoy en acento)
    sparkline($('#spark-participaciones'), porDia(todasPagadas, 14));

    // Gráficos
    const dias = porDia(pagadas, state.rango === 'hoy' ? 1 : state.rango === '7' ? 7 : state.rango === '30' ? 30 : Math.min(60, diasDesdePrimera(d.ordenes)));
    chartColumnas($('#chart-dias'), dias);
    tablaGemela($('#table-dias'), ['Día', 'Participaciones', 'Órdenes', 'Ingresos'], dias.map((x) => [fmtDiaLargo(x.fecha), fmtInt(x.valor), fmtInt(x.ordenes), fmtARS(x.ingresos)]), [1, 2, 3]);

    const porPack = d.packs.map((p) => {
      const os = compras.filter((o) => o.pack_id === p.id);
      return { etiqueta: p.nombre, valor: os.reduce((s, o) => s + o.cantidad_participaciones, 0), ordenes: os.length, ingresos: os.reduce((s, o) => s + Number(o.monto || 0), 0) };
    });
    chartBarras($('#chart-packs'), porPack, (x) => [{ titulo: x.etiqueta }, { k: 'participaciones', v: fmtInt(x.valor) }, { k: 'órdenes', v: fmtInt(x.ordenes) }, { k: 'ingresos', v: fmtARS(x.ingresos) }]);
    tablaGemela($('#table-packs'), ['Pack', 'Participaciones', 'Órdenes', 'Ingresos'], porPack.map((x) => [x.etiqueta, fmtInt(x.valor), fmtInt(x.ordenes), fmtARS(x.ingresos)]), [1, 2, 3]);

    const porBici = d.bicis.map((b) => ({ etiqueta: b.nombre, valor: pagadas.filter((o) => o.bici_preferida === b.id).reduce((s, o) => s + o.cantidad_participaciones, 0) }));
    meter($('#chart-bicis'), porBici);
    tablaGemela($('#table-bicis'), ['Bici', 'Participaciones', '%'], porBici.map((x) => [x.etiqueta, fmtInt(x.valor), `${partFiltro ? Math.round((x.valor / partFiltro) * 100) : 0} %`]), [1, 2]);

    const provMap = {};
    for (const o of pagadas) provMap[o.provincia || 'Sin dato'] = (provMap[o.provincia || 'Sin dato'] || 0) + o.cantidad_participaciones;
    const porProv = Object.entries(provMap).map(([etiqueta, valor]) => ({ etiqueta, valor })).sort((a, b) => b.valor - a.valor);
    const top = porProv.slice(0, 8);
    const resto = porProv.slice(8).reduce((s, x) => s + x.valor, 0);
    if (resto) top.push({ etiqueta: 'Otras', valor: resto });
    chartBarras($('#chart-provincias'), top, (x) => [{ titulo: x.etiqueta }, { k: 'participaciones', v: fmtInt(x.valor) }]);
    tablaGemela($('#table-provincias'), ['Provincia', 'Participaciones'], porProv.map((x) => [x.etiqueta, fmtInt(x.valor)]), [1]);

    // Transferencias por revisar
    renderRevision(enRevision, packsPorId);

    // Participaciones sin cargo que esperan la carta
    const cartas = d.ordenes.filter(esCartaPendiente);
    $('#kpi-cartas').textContent = fmtInt(cartas.length);
    $('#kpi-cartas-delta').textContent = cartas.length ? `${fmtInt(cartas.filter(cartaVencida).length)} fuera de plazo` : '';
    $('.tile-cartas').hidden = cartas.length === 0;
    renderCartas(cartas, bicisPorId);

    // Tabla de órdenes
    renderTabla(filas, packsPorId, bicisPorId);
  }

  /* ---------- vía gratuita en dos pasos: cartas pendientes ---------- */
  const esCartaPendiente = (o) => o.origen === 'gratuita' && o.estado === 'pendiente';
  const plazoCartaDias = () => Number(state.data?.participacion_gratuita?.plazo_carta_dias) || 15;
  const venceCarta = (o) => new Date(new Date(o.created_at).getTime() + plazoCartaDias() * DIA);
  const cartaVencida = (o) => venceCarta(o).getTime() < Date.now();

  function asegurarCardCartas() {
    if ($('#card-cartas')) return;
    const sec = document.createElement('section');
    sec.className = 'card';
    sec.id = 'card-cartas';
    sec.hidden = true;
    const head = document.createElement('div');
    head.className = 'card-head';
    const h2 = document.createElement('h2');
    h2.textContent = 'Cartas pendientes ';
    const count = document.createElement('span');
    count.className = 'count';
    count.id = 'cartas-count';
    count.textContent = '0';
    h2.appendChild(count);
    const p = document.createElement('p');
    p.textContent = 'Participaciones sin cargo registradas en el sitio que esperan la carta. Cuando llega, "Carta recibida" asigna la chance y manda el mail con el número.';
    head.append(h2, p);
    const ul = document.createElement('ul');
    ul.className = 'revision-list';
    ul.id = 'cartas-list';
    sec.append(head, ul);
    $('#card-revision').after(sec);
  }

  function renderCartas(lista, bicisPorId) {
    asegurarCardCartas();
    const card = $('#card-cartas');
    card.hidden = lista.length === 0;
    $('#cartas-count').textContent = fmtInt(lista.length);
    const ul = $('#cartas-list');
    ul.replaceChildren();
    for (const o of lista) {
      const li = document.createElement('li');
      const col1 = document.createElement('div');
      const nombre = document.createElement('b');
      nombre.textContent = `${o.nombre} ${o.apellido}`;
      const det = document.createElement('span');
      const vencida = cartaVencida(o);
      det.textContent = `DNI ${o.dni} · registrada el ${fmtFechaHora(o.created_at)} · ${vencida ? 'plazo vencido el' : 'vence el'} ${fmtDia(venceCarta(o).toISOString())}`;
      if (vencida) det.style.color = 'var(--status-critical)';
      col1.append(nombre, det);

      const col2 = document.createElement('div');
      col2.className = 'checks';
      for (const txt of [o.email, o.provincia || '—', (bicisPorId[o.bici_preferida]?.nombre || '').replace('Polygon ', '')]) {
        const s = document.createElement('span');
        s.textContent = txt;
        col2.appendChild(s);
      }

      const col3 = document.createElement('div');
      col3.className = 'acciones';
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'btn btn-primary';
      ok.textContent = 'Carta recibida';
      ok.addEventListener('click', () => accionCarta(o, 'carta_recibida'));
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'btn btn-ghost';
      no.textContent = 'Rechazar';
      no.addEventListener('click', () => accionCarta(o, 'carta_rechazada'));
      col3.append(ok, no);
      li.append(col1, col2, col3);
      ul.appendChild(li);
    }
  }

  async function accionCarta(o, accion) {
    if (state.demo) {
      if (accion === 'carta_recibida') {
        o.estado = 'pagada';
        o.pagada_at = new Date().toISOString();
        o.carta_recibida_at = o.pagada_at;
        state.data.participaciones_total += o.cantidad_participaciones;
        toast(`Carta recibida: ${o.nombre} recibe su chance por mail.`);
      } else {
        o.estado = 'rechazada';
        toast('Participación rechazada.');
      }
      render();
      return;
    }
    try {
      const res = await fetch('api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ accion, orden_id: o.id, revisor: 'panel' }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
      toast(accion === 'carta_recibida' ? `Carta recibida. Número: ${resumirNumeros(out.numeros)}` : 'Participación rechazada.');
      cargar({ silencioso: true });
    } catch (err) {
      toast(err.message);
    }
  }

  function diasDesdePrimera(ordenes) {
    if (!ordenes.length) return 7;
    const min = Math.min(...ordenes.map((o) => new Date(o.created_at).getTime()));
    return Math.max(7, Math.ceil((Date.now() - min) / DIA) + 1);
  }

  function porDia(ordenes, n) {
    const mapa = {};
    for (const o of ordenes) {
      const k = claveDia(o.pagada_at || o.created_at);
      mapa[k] = mapa[k] || { valor: 0, ordenes: 0, ingresos: 0 };
      mapa[k].valor += o.cantidad_participaciones;
      if (o.medio_pago !== 'gratuita') {
        mapa[k].ordenes += 1;
        mapa[k].ingresos += Number(o.monto || 0);
      }
    }
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const fecha = new Date(Date.now() - i * DIA);
      const k = claveDia(fecha.toISOString());
      out.push({ fecha: fecha.toISOString(), clave: k, valor: mapa[k]?.valor || 0, ordenes: mapa[k]?.ordenes || 0, ingresos: mapa[k]?.ingresos || 0 });
    }
    return out;
  }

  /* ---------- gráficos ---------- */
  function sparkline(el, serie) {
    el.replaceChildren();
    const W = 120, H = 32, max = Math.max(1, ...serie.map((s) => s.valor));
    const n = serie.length, band = W / n, bw = Math.max(2, band - 2);
    serie.forEach((s, i) => {
      const h = Math.round((s.valor / max) * (H - 4));
      const p = svg('path', { d: columna(i * band + 1, H - h, bw, h, 2), class: `bar ${i === n - 1 ? '' : 'is-muted'}` }, el);
      p.style.fill = i === n - 1 ? 'var(--viz-serie)' : 'var(--viz-muted)';
    });
  }

  function chartColumnas(el, serie) {
    el.replaceChildren();
    if (!serie.some((s) => s.valor > 0)) return vacio(el, 'Todavía no hay participaciones en este rango.');
    const W = Math.max(320, el.clientWidth || 600);
    const m = { t: 22, r: 12, b: 30, l: 42 };
    const H = 240;
    const plotW = W - m.l - m.r, plotH = H - m.t - m.b;
    const max = Math.max(1, ...serie.map((s) => s.valor));
    const ticks = ticksBonitos(max, 4);
    const yMax = ticks[ticks.length - 1];
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Participaciones por día' });
    const grid = svg('g', { class: 'grid' }, root);
    for (const t of ticks) {
      const y = m.t + plotH - (t / yMax) * plotH;
      svg('line', { x1: m.l, x2: W - m.r, y1: y, y2: y }, grid);
      texto(root, m.l - 8, y + 4, fmtInt(t), { 'text-anchor': 'end' });
    }
    svg('line', { x1: m.l, x2: W - m.r, y1: m.t + plotH, y2: m.t + plotH, class: 'axis' }, svg('g', { class: 'axis' }, root));
    const n = serie.length, band = plotW / n, bw = Math.min(24, Math.max(4, band - 4));
    const cada = n <= 14 ? 1 : Math.ceil(n / 8);
    serie.forEach((s, i) => {
      const x = m.l + i * band + (band - bw) / 2;
      const h = (s.valor / yMax) * plotH;
      const y = m.t + plotH - h;
      const esHoy = i === n - 1;
      const hit = svg('rect', { x: m.l + i * band, y: m.t, width: band, height: plotH, class: 'hit', tabindex: 0, role: 'img', 'aria-label': `${fmtDiaLargo(s.fecha)}: ${fmtInt(s.valor)} participaciones` }, root);
      svg('path', { d: columna(x, y, bw, h), class: `bar ${esHoy ? '' : 'is-muted'}` }, root);
      if (esHoy && s.valor > 0) texto(root, x + bw / 2, y - 6, fmtInt(s.valor), { 'text-anchor': 'middle', class: 'value' });
      if (i % cada === 0 || esHoy) texto(root, x + bw / 2, H - 10, esHoy ? 'hoy' : fmtDia(s.fecha), { 'text-anchor': 'middle' });
      conTip(hit, () => [{ titulo: fmtDiaLargo(s.fecha) }, { k: 'participaciones', v: fmtInt(s.valor) }, { k: 'órdenes', v: fmtInt(s.ordenes) }, { k: 'ingresos', v: fmtARS(s.ingresos) }]);
    });
    el.appendChild(root);
  }

  function chartBarras(el, serie, filasTip) {
    el.replaceChildren();
    if (!serie.length || !serie.some((s) => s.valor > 0)) return vacio(el, 'Sin datos en este rango.');
    const W = Math.max(280, el.clientWidth || 480);
    const rowH = 30, m = { t: 6, r: 56, b: 6, l: 128 };
    const H = m.t + serie.length * rowH + m.b;
    const plotW = W - m.l - m.r;
    const max = Math.max(1, ...serie.map((s) => s.valor));
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    svg('line', { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b, class: 'axis' }, svg('g', { class: 'axis' }, root));
    serie.forEach((s, i) => {
      const y = m.t + i * rowH + (rowH - 18) / 2;
      const w = (s.valor / max) * plotW;
      const hit = svg('rect', { x: 0, y: m.t + i * rowH, width: W, height: rowH, class: 'hit', tabindex: 0, role: 'img', 'aria-label': `${s.etiqueta}: ${fmtInt(s.valor)}` }, root);
      svg('path', { d: barra(m.l, y, w, 18), class: 'bar' }, root);
      const cat = texto(root, m.l - 10, y + 13, s.etiqueta, { 'text-anchor': 'end', class: 'cat' });
      if (s.etiqueta.length > 18) cat.textContent = `${s.etiqueta.slice(0, 17)}…`;
      texto(root, m.l + w + 8, y + 13, fmtInt(s.valor), { class: 'value' });
      conTip(hit, () => filasTip(s));
    });
    el.appendChild(root);
  }

  function meter(el, serie) {
    el.replaceChildren();
    const total = serie.reduce((s, x) => s + x.valor, 0);
    if (!total) return vacio(el, 'Sin datos en este rango.');
    // Una barra por bici (sirve para dos o más), a la misma escala (100 % = todas las chances).
    const list = document.createElement('div');
    list.className = 'meter-list';
    list.setAttribute('role', 'img');
    list.setAttribute('aria-label', serie.map((x) => `${x.etiqueta} ${Math.round((x.valor / total) * 100) } %`).join(', '));
    for (const x of serie) {
      const pct = Math.round((x.valor / total) * 100);
      const row = document.createElement('div');
      row.className = 'meter-row';
      const label = document.createElement('span');
      label.textContent = String(x.etiqueta).replace('Polygon ', '');
      const bar = document.createElement('div');
      bar.className = 'meter';
      const fill = document.createElement('b');
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);
      const val = document.createElement('b');
      val.className = 'meter-val';
      val.textContent = `${pct} % · ${fmtInt(x.valor)}`;
      row.append(label, bar, val);
      list.appendChild(row);
    }
    el.appendChild(list);
  }

  function vacio(el, msg) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.textContent = msg;
    el.appendChild(d);
  }

  function tablaGemela(el, cabeceras, filas, numericas = []) {
    el.replaceChildren();
    const t = document.createElement('table');
    const thead = t.createTHead();
    const tr = thead.insertRow();
    cabeceras.forEach((c, i) => {
      const th = document.createElement('th');
      th.textContent = c;
      if (numericas.includes(i)) th.className = 'num';
      tr.appendChild(th);
    });
    const tb = t.createTBody();
    for (const f of filas) {
      const r = tb.insertRow();
      f.forEach((v, i) => {
        const td = r.insertCell();
        td.textContent = v;
        if (numericas.includes(i)) td.className = 'num';
      });
    }
    el.appendChild(t);
  }

  /* ---------- revisión de transferencias ---------- */
  function renderRevision(lista, packsPorId) {
    const card = $('#card-revision');
    card.hidden = lista.length === 0;
    $('#revision-count').textContent = fmtInt(lista.length);
    const ul = $('#revision-list');
    ul.replaceChildren();
    for (const o of lista) {
      const li = document.createElement('li');
      const col1 = document.createElement('div');
      const nombre = document.createElement('b');
      nombre.textContent = `${o.nombre} ${o.apellido}`;
      const det = document.createElement('span');
      det.textContent = `${packsPorId[o.pack_id]?.nombre || o.pack_id} · ${fmtARS(o.monto)} · código ${o.codigo || '—'} · ${fmtFechaHora(o.comprobante_at || o.created_at)}`;
      col1.append(nombre, det);

      const col2 = document.createElement('div');
      col2.className = 'checks';
      const cd = o.comprobante_datos || {};
      const check = (ok, txt) => {
        const s = document.createElement('span');
        s.className = ok ? 'ok' : 'bad';
        s.textContent = txt;
        return s;
      };
      col2.append(
        check(Number(cd.monto_leido) === Number(o.monto), `monto leído ${cd.monto_leido != null ? fmtARS(cd.monto_leido) : '—'}`),
        check(cd.destino_ok, 'cuenta destino'),
        check(cd.codigo_ok, 'código en la transferencia'),
      );
      if (cd.fecha_leida) col2.append(check(true, `fecha ${cd.fecha_leida}`));
      if (o.comprobante_url) {
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = 'ver comprobante';
        a.addEventListener('click', (e) => {
          e.preventDefault();
          if (!state.demo) abrirComprobante(o.id);
        });
        col2.append(a);
      }

      const col3 = document.createElement('div');
      col3.className = 'acciones';
      col3.style.flexWrap = 'wrap';
      col3.style.alignItems = 'center';
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'btn btn-primary';
      ok.textContent = 'Aprobar';
      ok.addEventListener('click', () => accionOrden(o, 'aprobar'));
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'btn btn-ghost';
      no.textContent = 'Rechazar';
      no.addEventListener('click', () => accionOrden(o, 'rechazar'));
      col3.append(ok, no, controlAcreditada(o));
      li.append(col1, col2, col3);
      ul.appendChild(li);
    }
  }

  /* ---------- conciliación bancaria (transferencias) ---------- */
  // Control de tres estados: "Sin revisar" · "Llegó" · "No llegó". Marcar "Llegó" sobre una
  // orden pendiente / en revisión la aprueba (números + mail); "No llegó" solo la marca.
  function controlAcreditada(o) {
    const seg = document.createElement('div');
    seg.className = 'seg seg-acreditada';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', `¿Llegó la transferencia de ${o.nombre} ${o.apellido} al banco?`);
    seg.style.padding = '2px';
    seg.style.whiteSpace = 'nowrap';
    if (o.acreditada_at) seg.title = `Marcada el ${fmtFechaHora(o.acreditada_at)}${o.acreditada_nota ? ` · ${o.acreditada_nota}` : ''}`;
    const actual = o.acreditada ?? null;
    for (const [valor, etiqueta, color] of [[null, 'Sin revisar', ''], [true, 'Llegó', 'var(--status-good)'], [false, 'No llegó', 'var(--status-critical)']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = etiqueta;
      b.style.padding = '5px 9px';
      b.style.fontSize = '12px';
      b.setAttribute('aria-pressed', String(actual === valor));
      if (actual === valor && color) b.style.color = color;
      b.addEventListener('click', () => {
        if (actual !== valor) acreditarOrden(o, valor);
      });
      seg.appendChild(b);
    }
    return seg;
  }

  // Versión compacta para la tabla de órdenes (un <select> con las mismas tres opciones,
  // para que la columna "Banco" no desborde la tabla en pantallas de notebook).
  function selectAcreditada(o) {
    const sel = document.createElement('select');
    sel.className = 'select-acreditada';
    sel.setAttribute('aria-label', `¿Llegó la transferencia de ${o.nombre} ${o.apellido} al banco?`);
    Object.assign(sel.style, {
      padding: '3px 6px',
      borderRadius: '8px',
      border: '1px solid var(--line-2)',
      background: 'var(--bg)',
      color: o.acreditada === true ? 'var(--status-good)' : o.acreditada === false ? 'var(--status-critical)' : 'var(--text)',
      font: 'inherit',
      fontSize: '11px',
      fontWeight: '600',
    });
    for (const [valor, etiqueta] of [['', 'Sin revisar'], ['true', 'Llegó'], ['false', 'No llegó']]) {
      const op = document.createElement('option');
      op.value = valor;
      op.textContent = etiqueta;
      op.selected = String(o.acreditada ?? '') === valor;
      sel.appendChild(op);
    }
    if (o.acreditada_at) sel.title = `Marcada el ${fmtFechaHora(o.acreditada_at)}${o.acreditada_nota ? ` · ${o.acreditada_nota}` : ''}`;
    sel.addEventListener('change', () => acreditarOrden(o, sel.value === '' ? null : sel.value === 'true'));
    return sel;
  }

  async function acreditarOrden(o, valor) {
    const aprueba = valor === true && ['pendiente', 'en_revision'].includes(o.estado);
    if (state.demo) {
      o.acreditada = valor;
      o.acreditada_at = valor === null ? null : new Date().toISOString();
      if (aprueba) {
        o.estado = 'pagada';
        o.pagada_at = new Date().toISOString();
        state.data.participaciones_total += o.cantidad_participaciones;
      }
      toast(valor === true ? (aprueba ? `Acreditada y aprobada: ${o.nombre} recibe sus ${o.cantidad_participaciones} participaciones por mail.` : 'Marcada: la plata llegó.') : valor === false ? 'Marcada: la plata no llegó (queda para reclamar).' : 'Vuelve a "sin revisar".');
      render();
      return;
    }
    try {
      const res = await fetch('api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ accion: 'acreditar', orden_id: o.id, acreditada: valor, revisor: 'panel' }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
      const numeros = out.numeros?.length ? resumirNumeros(out.numeros) : '';
      toast(
        valor === true
          ? numeros ? `Acreditada y aprobada. Números: ${numeros}` : out.nota || 'Marcada: la plata llegó.'
          : valor === false ? 'Marcada: la plata no llegó (queda para reclamar).' : 'Vuelve a "sin revisar".',
      );
      cargar({ silencioso: true });
    } catch (err) {
      toast(err.message);
    }
  }

  async function accionOrden(o, accion) {
    if (state.demo) {
      o.estado = accion === 'aprobar' ? 'pagada' : 'rechazada';
      if (accion === 'aprobar') {
        o.pagada_at = new Date().toISOString();
        state.data.participaciones_total += o.cantidad_participaciones;
      }
      toast(accion === 'aprobar' ? `Aprobada: ${o.nombre} recibe ${o.cantidad_participaciones} participaciones por mail.` : 'Orden rechazada.');
      render();
      return;
    }
    try {
      const res = await fetch('api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ accion, orden_id: o.id, revisor: 'panel' }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
      toast(accion === 'aprobar' ? `Aprobada. Números: ${resumirNumeros(out.numeros)}` : 'Orden rechazada.');
      cargar({ silencioso: true });
    } catch (err) {
      toast(err.message);
    }
  }

  // Abre el comprobante en una pestaña nueva: se pide la URL firmada con el token en el
  // header y recién después se navega (la pestaña se abre en el click para que el
  // navegador no la bloquee como popup).
  async function abrirComprobante(ordenId) {
    const ventana = window.open('', '_blank');
    try {
      const res = await fetch(`api/comprobante?id=${encodeURIComponent(ordenId)}&json=1`, { cache: 'no-store', headers: authHeaders() });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.url) throw new Error(out.error || `HTTP ${res.status}`);
      if (ventana) ventana.location.href = out.url;
      else location.href = out.url;
    } catch (err) {
      if (ventana) ventana.close();
      toast(`No pudimos abrir el comprobante: ${err.message}`);
    }
  }

  // Descarga del padrón: fetch con el token en el header + Blob (nada de tokens en la URL).
  async function exportarCsv() {
    if (state.demo) return toast('La exportación no está disponible con datos de ejemplo.');
    const btn = $('#btn-export');
    btn.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch('api/export', { cache: 'no-store', headers: authHeaders() });
      if (!res.ok) {
        const out = await res.json().catch(() => ({}));
        throw new Error(out.error || `HTTP ${res.status}`);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `padron-${state.data?.edicion?.id || 'edicion'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast(`No pudimos exportar el padrón: ${err.message}`);
    } finally {
      btn.removeAttribute('aria-busy');
    }
  }

  /* ---------- tabla de órdenes ---------- */
  function renderTabla(filas, packsPorId, bicisPorId) {
    const q = state.q.trim().toLowerCase();
    const lista = (q
      ? state.data.ordenes.filter((o) => [o.nombre, o.apellido, o.dni, o.email, o.codigo].some((v) => String(v || '').toLowerCase().includes(q)))
      : filas
    ).slice(0, 100);
    $('#ordenes-count').textContent = fmtInt(q ? lista.length : filas.length);
    const tb = $('#tabla-ordenes tbody');
    tb.replaceChildren();
    const MEDIO = { mercadopago: 'Mercado Pago', transferencia: 'Transferencia', gratuita: 'Sin cargo' };
    const ESTADO = { pagada: 'Pagada', pendiente: 'Pendiente', en_revision: 'Por revisar', rechazada: 'Rechazada', reembolsada: 'Reembolsada', anulada: 'Anulada' };
    for (const o of lista) {
      const tr = tb.insertRow();
      tr.insertCell().textContent = fmtFechaHora(o.created_at);
      const tdN = tr.insertCell();
      tdN.textContent = `${o.nombre} ${o.apellido}`;
      const small = document.createElement('small');
      small.textContent = `${o.email} · DNI ${o.dni}`;
      tdN.appendChild(small);
      tr.insertCell().textContent = packsPorId[o.pack_id]?.nombre || (o.medio_pago === 'gratuita' ? 'Sin cargo' : o.pack_id);
      const tdP = tr.insertCell();
      tdP.className = 'num';
      tdP.textContent = fmtInt(o.cantidad_participaciones);
      tr.insertCell().textContent = (bicisPorId[o.bici_preferida]?.nombre || '').replace('Polygon ', '');
      tr.insertCell().textContent = o.provincia || '—';
      tr.insertCell().textContent = MEDIO[o.medio_pago] || o.medio_pago;
      const tdE = tr.insertCell();
      const chip = document.createElement('span');
      chip.className = `chip-estado ${o.estado}`;
      chip.textContent = ESTADO[o.estado] || o.estado;
      tdE.appendChild(chip);
      // Banco: conciliación manual de cada transferencia abierta o pagada, debajo del estado
      // (sin columna nueva: la tabla ya ocupa todo el ancho del contenedor).
      if (o.medio_pago === 'transferencia' && ESTADOS_CONCILIABLES.includes(o.estado)) {
        const sel = selectAcreditada(o);
        sel.style.display = 'block';
        sel.style.marginTop = '4px';
        tdE.appendChild(sel);
      }
      const tdM = tr.insertCell();
      tdM.className = 'num';
      tdM.textContent = o.medio_pago === 'gratuita' ? '—' : fmtARS(o.monto);
    }
    $('#tabla-meta').textContent = lista.length ? `Mostrando ${fmtInt(lista.length)} de ${fmtInt(q ? lista.length : filas.length)}${q ? ` resultados para “${state.q.trim()}”` : ''}` : 'Sin órdenes para mostrar.';
  }

  /* ---------- UI ---------- */
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-visible');
    setTimeout(() => el.classList.remove('is-visible'), 4200);
  }
  function mostrarLogin(error) {
    $('#login').hidden = false;
    $('#panel').hidden = true;
    $('#nav-actions').hidden = true;
    const e = $('#login-error');
    e.textContent = error || '';
    e.classList.toggle('is-visible', Boolean(error));
  }
  function mostrarPanel() {
    $('#login').hidden = true;
    $('#panel').hidden = false;
    $('#nav-actions').hidden = false;
    $('#demo-banner').hidden = !state.demo;
  }

  function initUI() {
    $('#filtro-rango').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-rango]');
      if (!b) return;
      state.rango = b.dataset.rango;
      $$('#filtro-rango button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      render();
    });
    // Filtro rápido "Sin conciliar" (transferencias con comprobante sin marcar en el banco).
    const btnConciliar = document.createElement('button');
    btnConciliar.type = 'button';
    btnConciliar.dataset.estado = 'sin_conciliar';
    btnConciliar.textContent = 'Sin conciliar';
    $('#filtro-estado').appendChild(btnConciliar);
    $('#filtro-estado').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-estado]');
      if (!b) return;
      setEstadoFiltro(b.dataset.estado);
    });
    // La celda "Estado" de la tabla lleva también el control de conciliación; KPI de
    // conciliación (clic = aplica el filtro).
    const thEstado = $$('#tabla-ordenes thead th').find((th) => th.textContent.trim() === 'Estado');
    if (thEstado) thEstado.textContent = 'Estado / Banco';
    const tile = document.createElement('div');
    tile.className = 'tile tile-conciliar';
    tile.setAttribute('role', 'button');
    tile.tabIndex = 0;
    tile.title = 'Ver las transferencias sin conciliar';
    tile.style.cursor = 'pointer';
    tile.style.gridColumn = 'span 2';
    const tileLabel = document.createElement('span');
    tileLabel.className = 'tile-label';
    tileLabel.textContent = 'Transferencias sin conciliar';
    const tileValue = document.createElement('span');
    tileValue.className = 'tile-value';
    tileValue.id = 'kpi-conciliar';
    tileValue.textContent = '0';
    const tileDelta = document.createElement('span');
    tileDelta.className = 'tile-delta';
    tileDelta.id = 'kpi-conciliar-delta';
    tile.append(tileLabel, tileValue, tileDelta);
    const irASinConciliar = () => {
      setEstadoFiltro('sin_conciliar');
      // Se desplaza la card (no la tabla, que puede tener scroll horizontal propio).
      $('#tabla-ordenes').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    tile.addEventListener('click', irASinConciliar);
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        irASinConciliar();
      }
    });
    $('.kpis').appendChild(tile);
    // KPI "Cartas pendientes" (vía gratuita en dos pasos): solo se muestra si hay alguna; clic = ir a la lista.
    const tileCartas = document.createElement('div');
    tileCartas.className = 'tile tile-cartas';
    tileCartas.hidden = true;
    tileCartas.setAttribute('role', 'button');
    tileCartas.tabIndex = 0;
    tileCartas.title = 'Ver las participaciones sin cargo que esperan la carta';
    tileCartas.style.cursor = 'pointer';
    tileCartas.style.gridColumn = 'span 2';
    const cartasLabel = document.createElement('span');
    cartasLabel.className = 'tile-label';
    cartasLabel.textContent = 'Cartas pendientes';
    const cartasValue = document.createElement('span');
    cartasValue.className = 'tile-value';
    cartasValue.id = 'kpi-cartas';
    cartasValue.textContent = '0';
    const cartasDelta = document.createElement('span');
    cartasDelta.className = 'tile-delta';
    cartasDelta.id = 'kpi-cartas-delta';
    tileCartas.append(cartasLabel, cartasValue, cartasDelta);
    const irACartas = () => $('#card-cartas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    tileCartas.addEventListener('click', irACartas);
    tileCartas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        irACartas();
      }
    });
    $('.kpis').appendChild(tileCartas);
    asegurarCardCartas();
    $('#buscar').addEventListener('input', (e) => {
      state.q = e.target.value;
      render();
    });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-toggle-table]');
      if (!b) return;
      const t = $(`#table-${b.dataset.toggleTable}`);
      t.hidden = !t.hidden;
      b.textContent = t.hidden ? 'Ver tabla' : 'Ver gráfico';
    });
    $('#btn-export').addEventListener('click', (e) => {
      e.preventDefault();
      exportarCsv();
    });
    $('#btn-salir').addEventListener('click', () => {
      store.del('bk_admin_token');
      location.href = 'admin.html';
    });
    $('#form-login').addEventListener('submit', (e) => {
      e.preventDefault();
      const token = $('#f-token').value.trim();
      if (!token) return;
      state.token = token;
      store.set('bk_admin_token', token);
      mostrarPanel();
      cargar();
      programar();
    });
    window.addEventListener('resize', () => state.data && render());
  }

  function programar() {
    clearInterval(state.timer);
    if (!state.demo) state.timer = setInterval(() => document.visibilityState === 'visible' && cargar({ silencioso: true }), 20000);
  }

  async function main() {
    initUI();
    const q = new URLSearchParams(location.search);
    state.demo = q.get('demo') === '1' || window.__ADMIN_DEMO__ === true;
    state.token = state.demo ? 'demo' : store.get('bk_admin_token');
    if (!state.token) return mostrarLogin();
    mostrarPanel();
    await cargar();
    programar();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', main) : main();
})();
