-- Sunice Vape Shop :: the only way anonymous customers touch orders.
-- Prices are always re-read from public.products; nothing the client sends about
-- money is trusted.

-- Four characters from a 32-symbol alphabet with 0/O/1/I removed, so a code read
-- out loud at pickup cannot be misheard.
create or replace function public.gen_order_code()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select string_agg(
           substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
                  1 + (get_byte(extensions.gen_random_bytes(4), g) % 32), 1), '')
  from generate_series(0, 3) g;
$$;

-- ---------------------------------------------------------------- create_order
create or replace function public.create_order(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_paused   boolean;
  v_order_id uuid;
  v_token    uuid;
  v_code     text;
  v_total    integer;
  v_inserted integer;
  v_wanted   integer;
  v_attempt  integer := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'CART_TOO_LARGE' using errcode = 'check_violation';
  end if;

  select is_paused into v_paused from public.shop_settings where id = 1;
  if coalesce(v_paused, false) then
    raise exception 'SHOP_PAUSED' using errcode = 'check_violation';
  end if;

  -- Reserve the order row first so the unique code retry stays cheap.
  loop
    v_attempt := v_attempt + 1;
    v_code := public.gen_order_code();
    begin
      insert into public.orders (code, total_cents)
      values (v_code, 0)
      returning id, access_token into v_order_id, v_token;
      exit;
    exception when unique_violation then
      if v_attempt >= 10 then raise; end if;
    end;
  end loop;

  -- Each line is clamped to 1..99, duplicates of the same product are merged,
  -- and name plus price are snapshotted so later edits never rewrite history.
  insert into public.order_items (order_id, product_id, product_name, unit_price_cents, quantity)
  select v_order_id, p.id, p.name, p.price_cents, a.quantity
  from (
    select (e->>'product_id')::uuid as product_id,
           least(99, sum(least(99, greatest(1, coalesce((e->>'quantity')::int, 1)))))::int as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  ) a
  join public.products p on p.id = a.product_id and p.is_active;
  get diagnostics v_inserted = row_count;

  select count(distinct (e->>'product_id')::uuid) into v_wanted
  from jsonb_array_elements(p_items) e;

  -- A line that did not resolve means the customer is looking at a stale shop.
  -- Abort rather than silently selling them a shorter order.
  if v_inserted is distinct from v_wanted then
    raise exception 'PRODUCT_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  select coalesce(sum(unit_price_cents::bigint * quantity), 0)
    into v_total
  from public.order_items
  where order_id = v_order_id;

  update public.orders set total_cents = v_total where id = v_order_id;

  return jsonb_build_object('id', v_order_id, 'code', v_code, 'access_token', v_token);
end;
$$;

-- ---------------------------------------------------------------- get_order
-- The access token is the capability: hold it and you see exactly this one order.
-- server_now travels with the payload so the countdown cannot drift with a phone
-- whose clock is off.
create or replace function public.get_order(p_access_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',                o.id,
    'code',              o.code,
    'status',            o.status,
    'total_cents',       o.total_cents,
    'created_at',        o.created_at,
    'accepted_at',       o.accepted_at,
    'pickup_expires_at', o.pickup_expires_at,
    'pickup_lat',        o.pickup_lat,
    'pickup_lng',        o.pickup_lng,
    'pickup_note',       o.pickup_note,
    'accepted_by_name',  a.animal_name,
    'server_now',        now(),
    'is_expired',        (o.status = 'accepted'
                          and o.pickup_expires_at is not null
                          and o.pickup_expires_at <= now()),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_name',     i.product_name,
               'unit_price_cents', i.unit_price_cents,
               'quantity',         i.quantity)
             order by i.product_name)
      from public.order_items i
      where i.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o
  left join public.admins a on a.id = o.accepted_by
  where o.access_token = p_access_token;
$$;

-- ---------------------------------------------------------------- admin actions
create or replace function public.accept_order(
  p_order_id uuid,
  p_lat      double precision default null,
  p_lng      double precision default null,
  p_note     text             default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.orders;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = 'insufficient_privilege';
  end if;
  if p_lat is null and p_lng is null and coalesce(btrim(p_note), '') = '' then
    raise exception 'PICKUP_REQUIRED' using errcode = 'check_violation';
  end if;

  -- The status predicate makes this the race winner's update: if two admins tap
  -- accept at once, exactly one row is touched and the other gets ORDER_NOT_PENDING.
  update public.orders
     set status            = 'accepted',
         accepted_by       = (select auth.uid()),
         accepted_at       = now(),
         pickup_expires_at = now() + interval '10 minutes',
         pickup_lat        = p_lat,
         pickup_lng        = p_lng,
         pickup_note       = nullif(btrim(p_note), '')
   where id = p_order_id
     and status = 'pending'
  returning * into v_row;

  if not found then
    raise exception 'ORDER_NOT_PENDING' using errcode = 'check_violation';
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.complete_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.orders;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = 'insufficient_privilege';
  end if;
  update public.orders set status = 'completed'
   where id = p_order_id and status = 'accepted'
  returning * into v_row;
  if not found then
    raise exception 'ORDER_NOT_ACCEPTED' using errcode = 'check_violation';
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.orders;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = 'insufficient_privilege';
  end if;
  update public.orders set status = 'cancelled'
   where id = p_order_id and status in ('pending', 'accepted')
  returning * into v_row;
  if not found then
    raise exception 'ORDER_NOT_OPEN' using errcode = 'check_violation';
  end if;
  return to_jsonb(v_row);
end;
$$;

-- ---------------------------------------------------------------- grants
revoke all on function public.gen_order_code()                                          from public;
revoke all on function public.create_order(jsonb)                                       from public;
revoke all on function public.get_order(uuid)                                           from public;
revoke all on function public.accept_order(uuid, double precision, double precision, text) from public;
revoke all on function public.complete_order(uuid)                                      from public;
revoke all on function public.cancel_order(uuid)                                        from public;

grant execute on function public.create_order(jsonb) to anon, authenticated;
grant execute on function public.get_order(uuid)     to anon, authenticated;
grant execute on function public.accept_order(uuid, double precision, double precision, text) to authenticated;
grant execute on function public.complete_order(uuid) to authenticated;
grant execute on function public.cancel_order(uuid)   to authenticated;
