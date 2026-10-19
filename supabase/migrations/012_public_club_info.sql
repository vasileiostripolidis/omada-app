create or replace function public.public_club_info() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('club_name', club_name, 'phone', phone, 'email', email, 'address', address, 'website', website)
  from club_settings where id = 1;
$$;
revoke all on function public.public_club_info() from public;
grant execute on function public.public_club_info() to anon, authenticated;
