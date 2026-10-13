-- ===== Προσκλήσεις γονέων (σύνδεσμος / QR) =====
create table if not exists public.guardian_invites (
  token text primary key default encode(extensions.gen_random_bytes(16), 'hex'),
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  expires_at timestamptz not null default now() + interval '60 days',
  used_at timestamptz,
  used_by uuid
);
alter table public.guardian_invites enable row level security;
create policy "office invites" on public.guardian_invites for all to authenticated using (is_office()) with check (is_office());

create or replace function public.invite_info(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when i.token is null then jsonb_build_object('valid', false, 'reason', 'not_found')
              when i.used_at is not null then jsonb_build_object('valid', false, 'reason', 'used')
              when i.expires_at < now() then jsonb_build_object('valid', false, 'reason', 'expired')
              else jsonb_build_object('valid', true, 'guardian', g.first_name, 'email', g.email,
                'kids', (select jsonb_agg(p.first_name order by p.first_name) from player_households ph join players p on p.id = ph.player_id where ph.household_id = g.household_id and p.active))
         end
  from (select t as tk) x
  left join guardian_invites i on i.token = x.tk
  left join guardians g on g.id = i.guardian_id;
$$;

create or replace function public.claim_invite(t text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i guardian_invites; uid uuid := auth.uid(); em text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  select * into i from guardian_invites where token = t for update;
  if i.token is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if i.used_at is not null and i.used_by is distinct from uid then return jsonb_build_object('ok', false, 'reason', 'used'); end if;
  if i.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  select email into em from profiles where id = uid;
  update guardians set profile_id = uid, email = coalesce(nullif(email, ''), em) where id = i.guardian_id;
  update profiles set role = 'parent' where id = uid and role = 'pending';
  update guardian_invites set used_at = now(), used_by = uid where token = t;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.invite_info(text) from public;
revoke all on function public.claim_invite(text) from public, anon;
grant execute on function public.invite_info(text) to anon, authenticated;
grant execute on function public.claim_invite(text) to authenticated;

-- ===== Ιστορικό αλλαγών =====
create table if not exists public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  tbl text not null,
  op text not null,
  row_id text,
  old_data jsonb,
  new_data jsonb
);
create index if not exists audit_log_at on public.audit_log (at desc);
create index if not exists audit_log_tbl on public.audit_log (tbl, row_id);
alter table public.audit_log enable row level security;
create policy "office read audit" on public.audit_log for select to authenticated using (is_office());

create or replace function public.audit_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; k text; dold jsonb := '{}'; dnew jsonb := '{}';
  noise text[] := array['status','paid_amount','emailed_at','receipt_sent_at','created_at','updated_at'];
begin
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if (o -> k) is distinct from (n -> k) and not (k = any(noise)) then
        dold := dold || jsonb_build_object(k, o -> k); dnew := dnew || jsonb_build_object(k, n -> k);
      end if;
    end loop;
    if dnew = '{}'::jsonb then return new; end if;
    o := dold; n := dnew;
  end if;
  insert into audit_log (actor, actor_email, tbl, op, row_id, old_data, new_data)
  values (auth.uid(), (select email from profiles where id = auth.uid()), tg_table_name, tg_op,
          coalesce(to_jsonb(coalesce(new, old)) ->> 'id', (to_jsonb(coalesce(new, old)) ->> 'player_id') || '/' || coalesce(to_jsonb(coalesce(new, old)) ->> 'household_id', to_jsonb(coalesce(new, old)) ->> 'team_id')),
          o, n);
  return coalesce(new, old);
end $$;
revoke all on function public.audit_trg() from public, anon, authenticated;

create or replace trigger audit_households after insert or update or delete on public.households for each row execute function audit_trg();
create or replace trigger audit_guardians after insert or update or delete on public.guardians for each row execute function audit_trg();
create or replace trigger audit_player_households after insert or update or delete on public.player_households for each row execute function audit_trg();
create or replace trigger audit_players after insert or update or delete on public.players for each row execute function audit_trg();
create or replace trigger audit_charges after insert or update or delete on public.charges for each row execute function audit_trg();
create or replace trigger audit_payments after insert or update or delete on public.payments for each row execute function audit_trg();
create or replace trigger audit_recurring_fees after insert or update or delete on public.recurring_fees for each row execute function audit_trg();
create or replace trigger audit_club_settings after update on public.club_settings for each row execute function audit_trg();
create or replace trigger audit_profiles after update on public.profiles for each row execute function audit_trg();
create or replace trigger audit_teams after insert or update or delete on public.teams for each row execute function audit_trg();
create or replace trigger audit_coach_teams after insert or delete on public.coach_teams for each row execute function audit_trg();
create or replace trigger audit_consents after insert on public.consents for each row execute function audit_trg();
create or replace trigger audit_guardian_invites after insert on public.guardian_invites for each row execute function audit_trg();

-- ===== Ειδοποιήσεις push =====
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own push subs" on public.push_subscriptions for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create table if not exists public.push_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  sent_by uuid,
  title text,
  body text,
  audience text,
  recipients int,
  delivered int
);
alter table public.push_log enable row level security;
create policy "office push log" on public.push_log for select to authenticated using (is_office());

-- Κλειδιά VAPID: δημιουργούνται από τη function "push" στην πρώτη χρήση και φυλάσσονται στο private schema
create or replace function public.get_push_public_key() returns text
language sql stable security definer set search_path = public, private as $$
  select value from private.config where key = 'vapid_public';
$$;
revoke all on function public.get_push_public_key() from public;
grant execute on function public.get_push_public_key() to anon, authenticated;

create or replace function public.push_keys() returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object('public', (select value from private.config where key = 'vapid_public'),
                            'private', (select value from private.config where key = 'vapid_private'));
$$;
create or replace function public.set_push_keys(pub text, priv text) returns void
language sql security definer set search_path = public, private as $$
  insert into private.config(key, value) values ('vapid_public', pub), ('vapid_private', priv)
  on conflict (key) do nothing;
$$;
revoke all on function public.push_keys() from public, anon, authenticated;
revoke all on function public.set_push_keys(text, text) from public, anon, authenticated;
grant execute on function public.push_keys() to service_role;
grant execute on function public.set_push_keys(text, text) to service_role;

-- Ποιοι λαμβάνουν: φίλτρα κοινού
create or replace function public.push_targets(p_audience text, p_team uuid default null, p_households uuid[] default null)
returns table (endpoint text, p256dh text, auth text, profile_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct s.endpoint, s.p256dh, s.auth, s.profile_id
  from push_subscriptions s join profiles pr on pr.id = s.profile_id
  where
    (p_audience = 'staff' and pr.role in ('admin','secretary','coach') and (p_team is null or pr.role <> 'coach' or exists (select 1 from coach_teams c where c.profile_id = pr.id and c.team_id = p_team)))
    or (p_audience in ('parents','all') and pr.role = 'parent' and exists (
          select 1 from guardians g join player_households ph on ph.household_id = g.household_id join players p on p.id = ph.player_id
          where g.profile_id = pr.id and p.active
            and (p_team is null or p.team_id = p_team)
            and (p_households is null or g.household_id = any(p_households))))
    or (p_audience = 'all' and pr.role in ('admin','secretary','coach') and p_households is null)
$$;
revoke all on function public.push_targets(text, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.push_targets(text, uuid, uuid[]) to service_role;
