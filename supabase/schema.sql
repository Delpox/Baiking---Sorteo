-- ============================================================
-- Baiking · Curso + Participación — esquema de base de datos
-- Postgres (Supabase). Ejecutar completo en SQL Editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- Una fila por edición del programa. El contador `ultimo_numero`
-- garantiza números de participación correlativos y sin huecos.
create table if not exists ediciones (
  id             text primary key,               -- ej: 'edicion-1'
  nombre         text not null,
  fecha_sorteo   timestamptz not null,
  cierre_ventas  timestamptz not null,
  activa         boolean not null default true,
  ultimo_numero  integer not null default 0,
  created_at     timestamptz not null default now()
);

-- Una orden = una compra del curso (con N participaciones incluidas).
create table if not exists ordenes (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),
  edicion_id                text not null references ediciones(id),
  pack_id                   text not null,
  cantidad_participaciones  integer not null check (cantidad_participaciones > 0),
  monto                     numeric(12,2) not null check (monto >= 0),
  moneda                    text not null default 'ARS',
  nombre                    text not null,
  apellido                  text not null,
  dni                       text not null,
  email                     text not null,
  whatsapp                  text not null,
  provincia                 text,
  -- id de config/campaign.json > bicis[]; la API valida contra la config (sin check acá,
  -- para que renombrar o agregar una bici no rompa las órdenes).
  bici_preferida            text not null,
  acepta_bases              boolean not null default false,
  -- pendiente: creada y sin pago · en_revision: transferencia con comprobante a aprobar
  estado                    text not null default 'pendiente'
                            check (estado in ('pendiente', 'en_revision', 'pagada', 'rechazada', 'reembolsada', 'anulada')),
  medio_pago                text not null default 'mercadopago'
                            check (medio_pago in ('mercadopago', 'transferencia', 'gratuita')),
  codigo                    text unique,          -- referencia corta para transferencias (ej: BK-7Q4M2)
  mp_preference_id          text,
  mp_payment_id             text unique,
  pagada_at                 timestamptz,
  comprobante_url           text,                 -- ruta en Supabase Storage (bucket "comprobantes")
  comprobante_datos         jsonb,                -- lo que la IA leyó del comprobante + checks
  comprobante_at            timestamptz,
  revisado_por              text,                 -- 'auto' o el nombre de quien aprobó en el panel
  revisado_at               timestamptz,
  -- Conciliación manual contra el home banking (transferencias): null = sin revisar,
  -- true = la plata llegó (aprueba la orden), false = no llegó (queda marcada para reclamar).
  acreditada                boolean,
  acreditada_at             timestamptz,
  acreditada_nota           text,
  email_enviado_at          timestamptz,
  whatsapp_enviado_at       timestamptz,
  origen                    text not null default 'web'
);

create index if not exists ordenes_email_idx  on ordenes (lower(email));
create index if not exists ordenes_estado_idx on ordenes (estado);
create index if not exists ordenes_edicion_idx on ordenes (edicion_id);

-- Vía gratuita ("sin obligación de compra"): una sola participación por DNI y edición.
create unique index if not exists ordenes_gratuita_dni_idx
  on ordenes (edicion_id, dni)
  where origen = 'gratuita';

-- Cada número de participación pertenece a una orden pagada.
create table if not exists participaciones (
  edicion_id  text not null references ediciones(id),
  numero      integer not null,
  orden_id    uuid not null references ordenes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (edicion_id, numero)
);

create index if not exists participaciones_orden_idx on participaciones (orden_id);

-- ------------------------------------------------------------
-- asignar_participaciones(orden_id)
-- Asigna N números correlativos a una orden de forma ATÓMICA
-- (bloquea la orden y el contador de la edición) e IDEMPOTENTE
-- (si la orden ya tiene números, los devuelve sin crear nuevos).
-- Lo llama el webhook de Mercado Pago cuando el pago queda aprobado.
-- ------------------------------------------------------------
create or replace function asignar_participaciones(p_orden_id uuid)
returns table (numero integer)
language plpgsql
as $$
declare
  v_orden  ordenes%rowtype;
  v_desde  integer;
  v_hasta  integer;
begin
  select * into v_orden from ordenes where id = p_orden_id for update;
  if not found then
    raise exception 'Orden % inexistente', p_orden_id;
  end if;

  if exists (select 1 from participaciones p where p.orden_id = p_orden_id) then
    return query
      select p.numero from participaciones p
       where p.orden_id = p_orden_id
       order by p.numero;
    return;
  end if;

  update ediciones
     set ultimo_numero = ultimo_numero + v_orden.cantidad_participaciones
   where id = v_orden.edicion_id
   returning ultimo_numero into v_hasta;

  if v_hasta is null then
    raise exception 'Edición % inexistente', v_orden.edicion_id;
  end if;

  v_desde := v_hasta - v_orden.cantidad_participaciones + 1;

  insert into participaciones (edicion_id, numero, orden_id)
  select v_orden.edicion_id, gs, p_orden_id
    from generate_series(v_desde, v_hasta) as gs;

  return query select gs from generate_series(v_desde, v_hasta) as gs;
end;
$$;

-- ------------------------------------------------------------
-- Presencia: visitantes en el sitio en tiempo real (beacon cada 30 s)
-- ------------------------------------------------------------
create table if not exists presencia (
  session_id  text primary key,
  pagina      text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists presencia_last_seen_idx on presencia (last_seen);
create index if not exists presencia_first_seen_idx on presencia (first_seen);
alter table presencia enable row level security;

-- Comprobantes de transferencia: crear el bucket privado "comprobantes" en
-- Storage (Supabase > Storage > New bucket, público: NO). El backend sube y
-- lee con la service_role key.

-- ------------------------------------------------------------
-- Vista para el padrón del sorteo (exportar CSV / escribano)
-- security_invoker: la vista corre con los permisos de quien consulta (y por lo
-- tanto respeta el RLS de ordenes/participaciones) en vez de los del dueño.
-- ------------------------------------------------------------
create or replace view padron_sorteo with (security_invoker = on) as
select p.edicion_id,
       p.numero,
       o.id           as orden_id,
       o.nombre,
       o.apellido,
       o.dni,
       o.email,
       o.whatsapp,
       o.provincia,
       o.bici_preferida,
       o.pack_id,
       o.medio_pago,
       o.pagada_at
  from participaciones p
  join ordenes o on o.id = p.orden_id
 where o.estado = 'pagada'
 order by p.edicion_id, p.numero;

-- ------------------------------------------------------------
-- Seguridad: RLS activado y sin políticas => solo la service_role
-- key (usada únicamente en el backend) puede leer/escribir.
-- Las vistas y funciones se cierran explícitamente para anon/authenticated:
-- Supabase les da SELECT/EXECUTE por defecto sobre todo lo de `public`, y una
-- vista sin security_invoker saltea el RLS (expondría nombre, DNI, mail y
-- WhatsApp de todo el padrón con la anon key, que es pública por diseño).
-- ------------------------------------------------------------
alter table ediciones       enable row level security;
alter table ordenes         enable row level security;
alter table participaciones enable row level security;

alter view padron_sorteo set (security_invoker = on);
revoke all on padron_sorteo from public, anon, authenticated;
grant select on padron_sorteo to service_role;

revoke execute on function asignar_participaciones(uuid) from public, anon, authenticated;
grant execute on function asignar_participaciones(uuid) to service_role;

-- ------------------------------------------------------------
-- Migraciones idempotentes para instalaciones existentes (el resto del
-- archivo usa `if not exists` / `or replace`, así que se puede correr
-- completo tanto para instalar de cero como para actualizar).
-- ------------------------------------------------------------
-- 1) La bici se valida contra config/campaign.json; se quita el check duplicado.
alter table ordenes drop constraint if exists ordenes_bici_preferida_check;
-- 2) Columnas usadas por el backend (por si el esquema se creó con una versión anterior).
alter table ordenes add column if not exists mp_payment_id       text;
alter table ordenes add column if not exists mp_preference_id    text;
alter table ordenes add column if not exists email_enviado_at    timestamptz;
alter table ordenes add column if not exists whatsapp_enviado_at timestamptz;
alter table ordenes add column if not exists comprobante_datos   jsonb;
create unique index if not exists ordenes_mp_payment_id_key on ordenes (mp_payment_id);
-- 3) Conciliación manual de transferencias contra el banco (panel: "Llegó" / "No llegó").
alter table ordenes add column if not exists acreditada      boolean;
alter table ordenes add column if not exists acreditada_at   timestamptz;
alter table ordenes add column if not exists acreditada_nota text;

-- ------------------------------------------------------------
-- Edición inicial (ajustar fechas antes de lanzar; deben coincidir
-- con config/campaign.json)
-- ------------------------------------------------------------
insert into ediciones (id, nombre, fecha_sorteo, cierre_ventas)
values ('edicion-1', 'Edición #1 · Polygon Siskiu T7 / Tambora', '2026-12-04 21:00-03', '2026-12-03 23:59-03')
on conflict (id) do nothing;
