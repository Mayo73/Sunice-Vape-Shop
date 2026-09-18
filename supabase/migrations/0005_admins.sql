-- Sunice Vape Shop :: the five admin accounts.
--
-- IMPORTANT: this file ships with placeholder passwords. The real ones were
-- generated at setup time, applied directly to the database, and handed over
-- separately (see ADMIN-CREDENTIALS.md, which is git-ignored). Passwords are
-- deliberately not stored in version control or in the migration history.
--
-- You only need to run this if you are rebuilding the Supabase project from
-- scratch. Replace every CHANGE-ME below first.
--
-- Admins sign in with their animal name; the app appends @sunice.app for them.

do $$
declare
  v     record;
  v_uid uuid;
begin
  for v in select * from (values
      ('gecko',   'CHANGE-ME-gecko'),
      ('kobra',   'CHANGE-ME-kobra'),
      ('mantis',  'CHANGE-ME-mantis'),
      ('panther', 'CHANGE-ME-panther'),
      ('skarab',  'CHANGE-ME-skarab')
    ) as t(animal, pw)
  loop
    v_uid := gen_random_uuid();

    -- Written straight into auth.users because this project has no server-side
    -- component to call the admin API from. The token columns are set to '' rather
    -- than left null: GoTrue reads them as plain strings and errors on null.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v.animal || '@sunice.app',
      extensions.crypt(v.pw, extensions.gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('animal_name', v.animal),
      '', '', '', '', '', '',
      false, false
    );

    -- Password sign-in needs a matching identity row, not just the user row.
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v.animal || '@sunice.app',
                         'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );

    -- Membership of this table is what public.is_admin() checks.
    insert into public.admins (id, animal_name) values (v_uid, v.animal);
  end loop;
end $$;

-- Verify the same way the auth service does, before trusting the accounts:
--
--   select u.email,
--          u.encrypted_password = extensions.crypt('<the password>', u.encrypted_password)
--            as password_verifies
--   from auth.users u
--   join auth.identities i on i.user_id = u.id
--   join public.admins a on a.id = u.id;
--
-- To change one password later:
--
--   update auth.users
--      set encrypted_password = extensions.crypt('<new password>', extensions.gen_salt('bf'))
--    where email = 'gecko@sunice.app';
