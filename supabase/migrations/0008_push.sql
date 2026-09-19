-- Sunice Vape Shop :: web push.
--
-- There is still no application server. A trigger on orders queues one HTTP
-- call (pg_net: asynchronous, sent after the transaction commits) to the "push"
-- edge function in supabase/functions/push. The function looks up who to tell
-- with the service key and speaks Web Push to the browsers' push services.
--
--   order inserted            -> every admin device
--   order pending -> accepted -> the devices of that order's customer
--
-- Secrets: the webhook secret is generated here, inside the database, and kept
-- in Vault; the edge function fetches it through push_config() with the
-- service key, so it is never typed, copied or committed anywhere. The VAPID
-- key pair is an edge function secret (README, "Push notifications"); its
-- public half goes into shop_settings.push_public_key, which is what a browser
-- needs in order to subscribe. While that column is null the app shows no
-- notification controls at all.

create extension if not exists pg_net;

-- ---------------------------------------------------------------- devices
-- An admin's devices. One row per browser; an admin may have several.
create table public.admin_push_subscriptions (
  endpoint   text primary key,
  admin_id   uuid not null references public.admins(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  constraint admin_push_endpoint_sane check (endpoint ~ '^https://' and length(endpoint) <= 2048),
  constraint admin_push_keys_sane     check (length(p256dh) <= 200 and length(auth) <= 100)
);
create index admin_push_subscriptions_admin_idx on public.admin_push_subscriptions (admin_id);

-- Admins see and remove their own devices directly; registering goes through
-- register_admin_push() so that a phone two admins share follows whoever is
-- signed in, which a plain upsert under these policies could not do.
alter table public.admin_push_subscriptions enable row level security;
create policy admin_push_own_read on public.admin_push_subscriptions
  for select to authenticated
  using (public.is_admin() and admin_id = (select auth.uid()));
create policy admin_push_own_delete on public.admin_push_subscriptions
  for delete to authenticated
  using (public.is_admin() and admin_id = (select auth.uid()));
revoke all on public.admin_push_subscriptions from anon;

-- A customer's device, tied to one order. Customers have no table access at
-- all: they go through subscribe_order_push() below and prove the order is
-- theirs with its access token, exactly like get_order().
create table public.order_push_subscriptions (
  endpoint   text primary key,
  order_id   uuid not null references public.orders(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  constraint order_push_endpoint_sane check (endpoint ~ '^https://' and length(endpoint) <= 2048),
  constraint order_push_keys_sane     check (length(p256dh) <= 200 and length(auth) <= 100)
);
create index order_push_subscriptions_order_idx on public.order_push_subscriptions (order_id);

alter table public.order_push_subscriptions enable row level security;
revoke all on public.order_push_subscriptions from anon, authenticated;

-- One row per message handed to the edge function. A retried or replayed call
-- finds the row and stops, so nobody is ever told the same thing twice.
create table public.push_deliveries (
  order_id   uuid not null references public.orders(id) on delete cascade,
  event      text not null check (event in ('order_created', 'order_accepted')),
  created_at timestamptz not null default now(),
  primary key (order_id, event)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon, authenticated;

-- ---------------------------------------------------------------- public key
alter table public.shop_settings add column push_public_key text;

-- Admins can still flip the pause switch and edit its message, but not the key:
-- every subscription is bound to it, so changing it would silence everyone.
-- Column privileges only take effect once the blanket table grant is gone.
revoke update on public.shop_settings from authenticated;
grant  update (is_paused, paused_message) on public.shop_settings to authenticated;

-- ---------------------------------------------------------------- rpcs
create or replace function public.register_admin_push(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or length(p_endpoint) > 2048
     or coalesce(length(p_p256dh), 0) not between 1 and 200
     or coalesce(length(p_auth), 0)   not between 1 and 100 then
    raise exception 'BAD_SUBSCRIPTION' using errcode = 'check_violation';
  end if;

  insert into public.admin_push_subscriptions (endpoint, admin_id, p256dh, auth)
  values (p_endpoint, (select auth.uid()), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set admin_id   = excluded.admin_id,
        p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        created_at = now();
end;
$$;

create or replace function public.subscribe_order_push(
  p_access_token uuid,
  p_endpoint     text,
  p_p256dh       text,
  p_auth         text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order_id uuid;
begin
  select id into v_order_id
    from public.orders
   where access_token = p_access_token
     and status in ('pending', 'accepted');
  if v_order_id is null then
    raise exception 'ORDER_NOT_OPEN' using errcode = 'check_violation';
  end if;

  -- The table constraints would reject this anyway; the check just keeps the
  -- message stable for the app.
  if coalesce(p_endpoint, '') !~ '^https://' or length(p_endpoint) > 2048
     or coalesce(length(p_p256dh), 0) not between 1 and 200
     or coalesce(length(p_auth), 0)   not between 1 and 100 then
    raise exception 'BAD_SUBSCRIPTION' using errcode = 'check_violation';
  end if;

  -- A browser keeps one subscription across orders, so the same endpoint
  -- simply moves on to the newest order.
  insert into public.order_push_subscriptions (endpoint, order_id, p256dh, auth)
  values (p_endpoint, v_order_id, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set order_id   = excluded.order_id,
        p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        created_at = now();
end;
$$;

-- What the edge function needs and nothing else. Service key only.
create or replace function public.push_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'webhook_secret',
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret')
  );
$$;

revoke all on function public.register_admin_push(text, text, text)          from public;
revoke all on function public.subscribe_order_push(uuid, text, text, text) from public;
revoke all on function public.push_config()                                 from public;
grant execute on function public.subscribe_order_push(uuid, text, text, text) to anon, authenticated;
grant execute on function public.register_admin_push(text, text, text)        to authenticated;
-- Default privileges hand new functions to anon and authenticated directly
-- (see 0007), so anything narrower needs explicit revokes too.
revoke execute on function public.register_admin_push(text, text, text) from anon;
revoke execute on function public.push_config() from anon, authenticated;
grant  execute on function public.push_config() to service_role;

-- ---------------------------------------------------------------- trigger
create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  text;
  v_url    text;
  v_secret text;
begin
  if tg_op = 'INSERT' then
    v_event := 'order_created';
  elsif new.status = 'accepted' and old.status = 'pending' then
    v_event := 'order_accepted';
  elsif new.status in ('completed', 'cancelled') and old.status <> new.status then
    -- The order is over; its devices have nothing more to hear.
    delete from public.order_push_subscriptions where order_id = new.id;
    return null;
  else
    return null;
  end if;

  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return null; -- push is not set up on this project; ordering must not care
  end if;

  -- The request is only queued here; pg_net sends it once this transaction has
  -- committed, so the function always sees the finished order, items and total
  -- included. Whatever goes wrong with the queue must never fail the order.
  begin
    perform net.http_post(
      url     := v_url,
      body    := jsonb_build_object('event', v_event, 'order_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
      timeout_milliseconds := 5000);
  exception when others then
    raise warning 'push: could not queue % for order %: %', v_event, new.id, sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.notify_push() from public, anon, authenticated;

create trigger orders_notify_push
  after insert or update of status on public.orders
  for each row execute function public.notify_push();

-- ---------------------------------------------------------------- secrets
-- Generated in the database so that nobody ever handles them. Re-running this
-- on a project that already has them changes nothing. The URL is this
-- project's; change it if the shop moves to another one.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_webhook_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'push_webhook_secret',
      'Shared secret between the orders trigger and the push edge function');
  end if;
  if not exists (select 1 from vault.secrets where name = 'push_function_url') then
    perform vault.create_secret(
      'https://kfveyjwamkzmyrtripqy.supabase.co/functions/v1/push',
      'push_function_url',
      'Where the orders trigger sends push events');
  end if;
end;
$$;
