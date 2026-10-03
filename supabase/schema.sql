-- ============================================================
-- Baiking · Productos digitales + sorteo — esquema de base de datos
-- Postgres (Supabase). Ejecutar completo en SQL Editor: es idempotente
-- (sirve para instalar de cero y para actualizar una instalación anterior).
--
-- Modelo: cada $1.000 del precio del producto = 1 participación (la vía gratuita,
-- 1 por persona). Cada orden pagada recibe UN bloque correlativo de números
-- (`ordenes.numero_desde` .. `ordenes.numero_hasta`); no hay una fila por número.
-- ============================================================

create extension if not exists "pgcrypto";

-- Una fila por edición del programa. El contador `ultimo_numero` garantiza bloques
-- de números correlativos y sin huecos: el total de participaciones emitidas es
-- siempre el máximo `numero_hasta` de la edición.
create table if not exists ediciones (
  id             text primary key,               -- ej: 'edicion-1'
  nombre         text not null,
  fecha_sorteo   timestamptz not null,
  cierre_ventas  timestamptz not null,
  activa         boolean not null default true,
  ultimo_numero  integer not null default 0,
  -- Recordatorios por mail (api/recordatorios.js): cuándo se mandó cada uno (una sola vez por edición).
  recordatorio_semana_at timestamptz,
  recordatorio_sorteo_at timestamptz,
  created_at     timestamptz not null default now()
);

-- Una orden = una compra de un producto digital (fondos, checklist o curso; cada producto
-- una sola vez por DNI) o una participación sin cargo (carta). `cantidad_participaciones`
-- es el precio dividido 1.000 (cada $1.000 = 1 participación; la vía gratuita, 1). Cuando la orden
-- queda pagada, asignar_participaciones() le asigna el bloque numero_desde..numero_hasta.
create table if not exists ordenes (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),
  edicion_id                text not null references ediciones(id),
  pack_id                   text not null,
  cantidad_participaciones  integer not null check (cantidad_participaciones > 0),
  -- Bloque correlativo de números de participación (null hasta que la orden queda pagada):
  -- numero_hasta - numero_desde + 1 = cantidad_participaciones.
  numero_desde              integer,
  numero_hasta              integer,
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
  -- Vía gratuita en dos pasos (formulario + carta a la tienda): cuándo se mandó el mail
  -- con las instrucciones y cuándo llegó la carta (recién ahí se asigna la participación).
  instrucciones_enviado_at  timestamptz,
  carta_recibida_at         timestamptz,
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

-- ------------------------------------------------------------
-- Bloque correlativo por orden. Las columnas van en el create table de arriba
-- (instalación de cero) y acá para las instalaciones anteriores; la vista y la
-- función de más abajo dependen de ellas, por eso este bloque va antes.
-- ------------------------------------------------------------
alter table ordenes add column if not exists numero_desde integer;
alter table ordenes add column if not exists numero_hasta integer;
-- O la orden no tiene bloque, o el bloque tiene exactamente cantidad_participaciones números.
alter table ordenes drop constraint if exists ordenes_bloque_check;
alter table ordenes add constraint ordenes_bloque_check check (
  (numero_desde is null and numero_hasta is null)
  or (numero_desde >= 1 and numero_hasta = numero_desde + cantidad_participaciones - 1)
);
-- Dos órdenes de la misma edición nunca empiezan en el mismo número.
create unique index if not exists ordenes_bloque_idx
  on ordenes (edicion_id, numero_desde)
  where numero_desde is not null;

-- ------------------------------------------------------------
-- Migración desde el modelo anterior (una fila por número en la tabla
-- `participaciones`, generada con generate_series): con 25.000 números por orden
-- eran millones de filas. Se elimina la tabla junto con la vista y la función que
-- dependían de ella (la función cambia el tipo de retorno: hay que borrarla antes
-- de recrearla). No hay base en producción: la migración es destructiva (una orden
-- pagada con el modelo viejo queda sin bloque; volver a llamar
-- asignar_participaciones() le asigna uno nuevo).
-- ------------------------------------------------------------
drop view if exists padron_sorteo;
drop table if exists participaciones cascade;
drop function if exists asignar_participaciones(uuid);

-- ------------------------------------------------------------
-- asignar_participaciones(orden_id) → (numero_desde, numero_hasta)
-- Asigna a una orden su bloque correlativo de números de forma ATÓMICA
-- (bloquea la orden con `for update` y avanza el contador de la edición en el
-- mismo update) e IDEMPOTENTE (si la orden ya tiene bloque, lo devuelve sin
-- tocar nada). La llama el backend al confirmar la orden (webhook de Mercado
-- Pago, aprobación de transferencias, carta recibida de la vía gratuita).
-- ------------------------------------------------------------
create function asignar_participaciones(p_orden_id uuid)
returns table (numero_desde integer, numero_hasta integer)
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

  if v_orden.numero_desde is not null then
    numero_desde := v_orden.numero_desde;
    numero_hasta := v_orden.numero_hasta;
    return next;
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

  update ordenes
     set numero_desde = v_desde,
         numero_hasta = v_hasta
   where id = p_orden_id;

  numero_desde := v_desde;
  numero_hasta := v_hasta;
  return next;
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
-- Vista para el padrón del sorteo: UNA fila por orden pagada con bloque
-- (numero_desde, numero_hasta, cantidad) y los datos de la persona. Es lo que
-- exporta /api/export (CSV) y lo que se cierra y publica antes del sorteo en
-- vivo (sorteo.html sortea un entero entre 1 y el total y gana la orden cuyo
-- bloque lo contiene).
-- security_invoker: la vista corre con los permisos de quien consulta (y por lo
-- tanto respeta el RLS de ordenes) en vez de los del dueño.
-- ------------------------------------------------------------
create view padron_sorteo with (security_invoker = on) as
select o.edicion_id,
       o.numero_desde,
       o.numero_hasta,
       o.numero_hasta - o.numero_desde + 1 as cantidad,
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
  from ordenes o
 where o.estado = 'pagada'
   and o.numero_desde is not null
 order by o.edicion_id, o.numero_desde;

-- ------------------------------------------------------------
-- Seguridad: RLS activado y sin políticas => solo la service_role
-- key (usada únicamente en el backend) puede leer/escribir.
-- Las vistas y funciones se cierran explícitamente para anon/authenticated:
-- Supabase les da SELECT/EXECUTE por defecto sobre todo lo de `public`, y una
-- vista sin security_invoker saltea el RLS (expondría nombre, DNI, mail y
-- WhatsApp de todo el padrón con la anon key, que es pública por diseño).
-- ------------------------------------------------------------
alter table ediciones enable row level security;
alter table ordenes   enable row level security;

alter view padron_sorteo set (security_invoker = on);
revoke all on padron_sorteo from public, anon, authenticated;
grant select on padron_sorteo to service_role;

revoke execute on function asignar_participaciones(uuid) from public, anon, authenticated;
grant execute on function asignar_participaciones(uuid) to service_role;

-- ------------------------------------------------------------
-- Migraciones idempotentes para instalaciones existentes (el resto del
-- archivo usa `if not exists` / `drop ... if exists`, así que se puede correr
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
-- 4) Vía gratuita en dos pasos (formulario + carta): mail de instrucciones y recepción de la carta.
alter table ordenes add column if not exists instrucciones_enviado_at timestamptz;
alter table ordenes add column if not exists carta_recibida_at        timestamptz;
-- 5) Recordatorios por mail (una semana antes y el día del sorteo), una sola vez por edición.
alter table ediciones add column if not exists recordatorio_semana_at timestamptz;
alter table ediciones add column if not exists recordatorio_sorteo_at timestamptz;
-- 6) Bloque correlativo por orden (numero_desde / numero_hasta) y baja de la tabla
--    `participaciones`: ver el bloque "Bloque correlativo por orden" más arriba.

-- ------------------------------------------------------------
-- Edición inicial (ajustar fechas antes de lanzar; deben coincidir
-- con config/campaign.json)
-- ------------------------------------------------------------
insert into ediciones (id, nombre, fecha_sorteo, cierre_ventas)
values ('edicion-1', 'Edición #1 · Polygon Siskiu T7 / Tambora', '2026-12-04 21:00-03', '2026-12-03 23:59-03')
on conflict (id) do nothing;
