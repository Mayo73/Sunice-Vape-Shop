-- Sunice Vape Shop :: row level security
-- Customers are anonymous and never touch orders directly -- they go through the
-- SECURITY DEFINER rpcs in 0003. Everything an admin does is gated on is_admin().

-- SECURITY DEFINER so the lookup on public.admins does not re-enter that table's
-- own policy (which would recurse). STABLE so it is evaluated once per statement.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins a where a.id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.shop_settings enable row level security;
alter table public.admins       enable row level security;
alter table public.products     enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;

-- ---------------------------------------------------------------- shop settings
create policy shop_settings_read_all on public.shop_settings
  for select to anon, authenticated using (true);
create policy shop_settings_admin_write on public.shop_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- admins
-- Animal names are only visible to signed-in admins; customers learn the name of
-- the admin who accepted their order through get_order() instead.
create policy admins_read_admins on public.admins
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- products
create policy products_read_active on public.products
  for select to anon, authenticated using (is_active or public.is_admin());
create policy products_admin_insert on public.products
  for insert to authenticated with check (public.is_admin());
create policy products_admin_update on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_admin_delete on public.products
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- orders
-- Deliberately no anon policy: with RLS on and nothing granted, anon reads nothing.
create policy orders_admin_all on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy order_items_admin_all on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Belt and braces: drop the blanket table grants Supabase hands anon by default,
-- so a policy added by accident later still cannot expose orders.
revoke all on public.orders      from anon;
revoke all on public.order_items from anon;
revoke all on public.admins      from anon;
