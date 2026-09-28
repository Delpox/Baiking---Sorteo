/* Página /gracias: muestra el estado de una orden y sus participaciones.
   ?orden=<uuid>  → consulta /api/orden
   ?demo=1        → muestra datos de ejemplo (para demostraciones)              */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const TZ = 'America/Argentina/Buenos_Aires';
  const fmtNum = (n) => String(n).padStart(4, '0');
  const fmtFecha = (iso) =>
    new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(iso));

  function show(id) {
    ['cargando', 'ok', 'pendiente', 'error'].forEach((k) => ($(`#estado-${k}`).hidden = k !== id));
  }

  async function cfg() {
    if (window.__CAMPAIGN__) return window.__CAMPAIGN__;
    return (await fetch('config/campaign.json', { cache: 'no-cache' })).json();
  }

  function render(orden, campaign) {
    $('#ok-nombre').textContent = orden.nombre;
    $('#ok-numeros').innerHTML = orden.numeros.map((n) => `<li>${fmtNum(n)}</li>`).join('');
    $('#ok-titulo').textContent = orden.numeros.length > 1 ? 'Tus participaciones' : 'Tu participación';
    $('#ok-bici').textContent = orden.bici?.nombre || '—';
    $('#ok-pack').textContent = orden.pack ? orden.pack.nombre : 'Participación sin cargo';
    $('#ok-sorteo').textContent = `${fmtFecha(campaign.edicion.fecha_sorteo)} hs`;
    $('#ok-orden').textContent = orden.id;
    const curso = $('#ok-curso');
    if (orden.pack && campaign.curso.url_acceso) curso.href = campaign.curso.url_acceso;
    else if (!orden.pack) curso.hidden = true;
    else curso.href = campaign.marca.web;
    const texto = `¡Ya estoy participando por una ${orden.bici?.nombre || 'Polygon'} con Baiking! 🚵 Mirá: ${location.origin}${location.pathname.replace(/gracias(\.html)?$/, '')}`;
    $('#ok-share').href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    show('ok');
  }

  async function main() {
    const q = new URLSearchParams(location.search);
    const campaign = await cfg();

    if (q.get('demo') === '1') {
      return render(
        {
          id: 'demo-0000-0000',
          nombre: 'Delfina',
          numeros: [142, 143, 144, 145, 146],
          bici: campaign.bicis[0],
          pack: campaign.packs.find((p) => p.destacado) || campaign.packs[0],
        },
        campaign,
      );
    }

    const id = q.get('orden');
    if (!id) return show('error');

    try {
      const res = await fetch(`api/orden?id=${encodeURIComponent(id)}`);
      if (!res.ok) return show('error');
      const orden = await res.json();
      if (orden.estado === 'pagada' && orden.numeros.length) return render(orden, campaign);
      if (orden.estado === 'pendiente') {
        show('pendiente');
        // Reintenta unos minutos: el webhook de Mercado Pago suele llegar en segundos.
        let intentos = 0;
        const t = setInterval(async () => {
          intentos += 1;
          const r = await fetch(`api/orden?id=${encodeURIComponent(id)}`).then((x) => x.json()).catch(() => null);
          if (r && r.estado === 'pagada' && r.numeros.length) {
            clearInterval(t);
            render(r, campaign);
          }
          if (intentos > 40) clearInterval(t);
        }, 5000);
        return;
      }
      show('error');
    } catch {
      show('error');
    }
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', main) : main();
})();
