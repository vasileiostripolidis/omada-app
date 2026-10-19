alter table public.push_subscriptions add column if not exists platform text not null default 'web';
alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth drop not null;

create or replace function public.push_targets_v2(p_audience text, p_team uuid default null, p_households uuid[] default null)
returns table (endpoint text, p256dh text, auth text, platform text, profile_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct s.endpoint, s.p256dh, s.auth, s.platform, s.profile_id
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
revoke all on function public.push_targets_v2(text, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.push_targets_v2(text, uuid, uuid[]) to service_role;
