-- Sunice Vape Shop :: core schema
-- Cash-only pickup shop. Unlimited stock (no stock column anywhere by design).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- shop settings
create table public.shop_settings (
  id             smallint primary key default 1 check (id = 1),
  is_paused      boolean     not null default false,
  paused_message text        not null default 'We are closed right now. Check back soon.',
  updated_at     timestamptz not null default now()
);
insert into public.shop_settings (id) values (1);

-- ---------------------------------------------------------------- admins
create table public.admins (
  id          uuid primary key references auth.users (id) on delete cascade,
  animal_name text        not null unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- products
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null check (length(btrim(name)) between 1 and 120),
  description text        not null default '' check (length(description) <= 2000),
  price_cents integer     not null check (price_cents >= 0 and price_cents <= 1000000),
  image_path  text,
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index products_listing_idx on public.products (is_active, sort_order, created_at desc);

-- ---------------------------------------------------------------- orders
create type public.order_status as enum ('pending', 'accepted', 'completed', 'cancelled');

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  -- short code the customer reads out at pickup; the only thing they have to remember
  code              text not null unique,
  -- secret capability token: whoever holds it may read this one order (kept in localStorage)
  access_token      uuid not null unique default gen_random_uuid(),
  status            public.order_status not null default 'pending',
  total_cents       integer not null check (total_cents >= 0),
  accepted_by       uuid references public.admins (id) on delete set null,
  accepted_at       timestamptz,
  pickup_expires_at timestamptz,
  pickup_lat        double precision check (pickup_lat between -90 and 90),
  pickup_lng        double precision check (pickup_lng between -180 and 180),
  pickup_note       text check (length(pickup_note) <= 500),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- an accepted order always carries who accepted it and until when it can be picked up
  constraint orders_accepted_fields check (
    (status = 'pending' and accepted_at is null and pickup_expires_at is null)
    or (status <> 'pending')
  )
);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_access_token_idx on public.orders (access_token);

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  -- kept for reference only; deleting a product must not rewrite order history
  product_id       uuid references public.products (id) on delete set null,
  product_name     text    not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity         integer not null check (quantity between 1 and 99)
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger shop_settings_touch before update on public.shop_settings
  for each row execute function public.touch_updated_at();
