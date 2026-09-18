-- Sunice Vape Shop :: follow-up hardening from the database linter.

-- 1. Pin the trigger function's search_path. Without it the function resolves
--    names against whatever search_path the calling role has set.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2. Supabase grants EXECUTE on new functions to anon and authenticated through
--    default privileges, which is a direct grant that "revoke ... from public"
--    does not touch. The admin-only rpcs already refuse a non-admin caller with
--    NOT_ADMIN, but anonymous visitors should not be able to reach them at all.
revoke execute on function public.accept_order(uuid, double precision, double precision, text) from anon;
revoke execute on function public.complete_order(uuid) from anon;
revoke execute on function public.cancel_order(uuid)   from anon;
revoke execute on function public.gen_order_code()     from anon, authenticated;

--    create_order and get_order stay callable by anon: that is the whole point of
--    a shop without accounts. is_admin() also stays, because the policy on
--    public.products calls it while evaluating an anonymous read.

-- 3. Cover the two foreign keys that had no index. get_order joins admins on
--    orders.accepted_by, and deleting a product scans order_items.product_id.
create index if not exists orders_accepted_by_idx   on public.orders (accepted_by);
create index if not exists order_items_product_idx  on public.order_items (product_id);
