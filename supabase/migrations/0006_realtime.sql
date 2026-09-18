-- Sunice Vape Shop :: realtime for the admin order board.
-- RLS still applies to realtime, so only signed-in admins receive these rows.

alter publication supabase_realtime add table public.orders;

-- Full row images on update, so the admin board sees the previous status too.
alter table public.orders replica identity full;
