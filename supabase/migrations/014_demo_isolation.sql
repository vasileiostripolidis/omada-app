-- ===== Δεδομένα επίδειξης (για τον ελεγκτή της Apple) απομονωμένα από τα πραγματικά =====
-- Οι λογαριασμοί demo (προπονητής της ομάδας demo / γονέας οικογένειας demo) βλέπουν ΜΟΝΟ δεδομένα demo.
-- Οι πραγματικοί χρήστες ΔΕΝ βλέπουν ποτέ δεδομένα demo. Υλοποιείται με RESTRICTIVE policies (AND με τις υπάρχουσες).
alter table public.teams add column if not exists is_demo boolean not null default false;
alter table public.households add column if not exists is_demo boolean not null default false;

create or replace function public.is_demo_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from coach_teams c join teams t on t.id = c.team_id where c.profile_id = auth.uid() and t.is_demo)
      or exists (select 1 from guardians g join households h on h.id = g.household_id where g.profile_id = auth.uid() and h.is_demo);
$$;
create or replace function public.demo_team(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce((select is_demo from teams where id = tid), false) $$;
create or replace function public.demo_household(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce((select is_demo from households where id = hid), false) $$;
create or replace function public.demo_player(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce((select t.is_demo from players p join teams t on t.id = p.team_id where p.id = pid), false) $$;
revoke all on function public.is_demo_user() from public, anon;
revoke all on function public.demo_team(uuid) from public, anon;
revoke all on function public.demo_household(uuid) from public, anon;
revoke all on function public.demo_player(uuid) from public, anon;
grant execute on function public.is_demo_user(), public.demo_team(uuid), public.demo_household(uuid), public.demo_player(uuid) to authenticated;

create policy "demo isolation" on public.teams as restrictive for all to authenticated using (is_demo = (select is_demo_user())) with check (is_demo = (select is_demo_user()));
create policy "demo hidden from public" on public.teams as restrictive for select to anon using (not is_demo);
create policy "demo isolation" on public.households as restrictive for all to authenticated using (is_demo = (select is_demo_user())) with check (is_demo = (select is_demo_user()));
create policy "demo isolation" on public.players as restrictive for all to authenticated using (demo_team(team_id) = (select is_demo_user())) with check (demo_team(team_id) = (select is_demo_user()));
create policy "demo isolation" on public.guardians as restrictive for all to authenticated using (demo_household(household_id) = (select is_demo_user())) with check (demo_household(household_id) = (select is_demo_user()));
create policy "demo isolation" on public.player_households as restrictive for all to authenticated using (demo_household(household_id) = (select is_demo_user())) with check (demo_household(household_id) = (select is_demo_user()));
create policy "demo isolation" on public.charges as restrictive for all to authenticated using ((case when household_id is not null then demo_household(household_id) else demo_player(player_id) end) = (select is_demo_user())) with check ((case when household_id is not null then demo_household(household_id) else demo_player(player_id) end) = (select is_demo_user()));
create policy "demo isolation" on public.payments as restrictive for all to authenticated using ((case when household_id is not null then demo_household(household_id) else demo_player(player_id) end) = (select is_demo_user())) with check ((case when household_id is not null then demo_household(household_id) else demo_player(player_id) end) = (select is_demo_user()));
create policy "demo isolation" on public.events as restrictive for all to authenticated using (demo_team(team_id) = (select is_demo_user())) with check (demo_team(team_id) = (select is_demo_user()));
create policy "demo isolation" on public.training_slots as restrictive for all to authenticated using (demo_team(team_id) = (select is_demo_user())) with check (demo_team(team_id) = (select is_demo_user()));
create policy "demo isolation" on public.announcements as restrictive for all to authenticated using (demo_team(team_id) = (select is_demo_user())) with check (demo_team(team_id) = (select is_demo_user()));
create policy "demo isolation" on public.photos as restrictive for all to authenticated using (demo_team(team_id) = (select is_demo_user())) with check (demo_team(team_id) = (select is_demo_user()));
create policy "demo isolation" on public.standings as restrictive for all to authenticated using (demo_team(team_id) = (select is_demo_user())) with check (demo_team(team_id) = (select is_demo_user()));
create policy "demo isolation" on public.coach_teams as restrictive for all to authenticated using (demo_team(team_id) = (select is_demo_user())) with check (demo_team(team_id) = (select is_demo_user()));
create policy "demo isolation" on public.player_stats as restrictive for all to authenticated using (demo_player(player_id) = (select is_demo_user())) with check (demo_player(player_id) = (select is_demo_user()));
create policy "demo isolation" on public.player_metrics as restrictive for all to authenticated using (demo_player(player_id) = (select is_demo_user())) with check (demo_player(player_id) = (select is_demo_user()));
create policy "demo isolation" on public.player_evaluations as restrictive for all to authenticated using (demo_player(player_id) = (select is_demo_user())) with check (demo_player(player_id) = (select is_demo_user()));
create policy "demo isolation" on public.player_goals as restrictive for all to authenticated using (demo_player(player_id) = (select is_demo_user())) with check (demo_player(player_id) = (select is_demo_user()));
create policy "demo isolation" on public.injuries as restrictive for all to authenticated using (demo_player(player_id) = (select is_demo_user())) with check (demo_player(player_id) = (select is_demo_user()));
create policy "demo isolation" on public.player_files as restrictive for all to authenticated using (demo_player(player_id) = (select is_demo_user())) with check (demo_player(player_id) = (select is_demo_user()));
create policy "demo isolation" on public.consents as restrictive for all to authenticated using (demo_player(player_id) = (select is_demo_user())) with check (demo_player(player_id) = (select is_demo_user()));
create policy "demo isolation" on public.equipment_issues as restrictive for all to authenticated using (demo_player(player_id) = (select is_demo_user())) with check (demo_player(player_id) = (select is_demo_user()));

-- Διαχείριση λογαριασμών demo από τις Ρυθμίσεις (μόνο διαχειριστής/γραμματεία)
create or replace function public.demo_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not is_office() then null else jsonb_build_object(
    'team', (select name from teams where is_demo limit 1),
    'players', (select count(*) from players p join teams t on t.id = p.team_id where t.is_demo),
    'parents', (select jsonb_agg(pr.email) from guardians g join households h on h.id = g.household_id join profiles pr on pr.id = g.profile_id where h.is_demo),
    'coaches', (select jsonb_agg(pr.email) from coach_teams c join teams t on t.id = c.team_id join profiles pr on pr.id = c.profile_id where t.is_demo)
  ) end;
$$;
create or replace function public.demo_parent_invite() returns text
language plpgsql security definer set search_path = public as $$
declare gid uuid; tok text;
begin
  if not is_office() then raise exception 'Δεν επιτρέπεται'; end if;
  select g.id into gid from guardians g join households h on h.id = g.household_id where h.is_demo and g.profile_id is null order by g.created_at limit 1;
  if gid is null then return null; end if;
  select token into tok from guardian_invites where guardian_id = gid and used_at is null and expires_at > now() order by created_at desc limit 1;
  if tok is null then insert into guardian_invites(guardian_id, expires_at) values (gid, now() + interval '365 days') returning token into tok; end if;
  return tok;
end $$;
create or replace function public.make_demo_coach(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare pid uuid; r text; tid uuid;
begin
  if not is_office() then raise exception 'Δεν επιτρέπεται'; end if;
  select id, role into pid, r from profiles where lower(email) = lower(trim(p_email));
  if pid is null then return 'not_found'; end if;
  if r in ('admin', 'secretary') then return 'is_staff'; end if;
  if exists (select 1 from guardians g join households h on h.id = g.household_id where g.profile_id = pid and not h.is_demo) then return 'is_parent'; end if;
  if exists (select 1 from coach_teams c join teams t on t.id = c.team_id where c.profile_id = pid and not t.is_demo) then return 'is_real_coach'; end if;
  select id into tid from teams where is_demo limit 1;
  update profiles set role = 'coach' where id = pid;
  insert into coach_teams(profile_id, team_id) select pid, tid where not exists (select 1 from coach_teams where profile_id = pid and team_id = tid);
  return 'ok';
end $$;
revoke all on function public.demo_status() from public, anon;
revoke all on function public.demo_parent_invite() from public, anon;
revoke all on function public.make_demo_coach(text) from public, anon;
grant execute on function public.demo_status(), public.demo_parent_invite(), public.make_demo_coach(text) to authenticated;
