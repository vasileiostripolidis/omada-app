create or replace function public.cron_reminders() returns void
language plpgsql security definer set search_path = public, private as $$
declare s club_settings; d int := extract(day from (now() at time zone 'Europe/Athens'))::int;
  h jsonb := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from private.config where key='cron_secret'));
begin
  select * into s from club_settings where id = 1;
  if s.auto_reminders and d in (s.reminder_day_1, s.reminder_day_2) then
    perform net.http_post(url := 'https://hcdrskfzznsrwedcstsx.supabase.co/functions/v1/billing', headers := h,
      body := jsonb_build_object('action','reminders'), timeout_milliseconds := 120000);
    perform net.http_post(url := 'https://hcdrskfzznsrwedcstsx.supabase.co/functions/v1/push', headers := h,
      body := jsonb_build_object('action','debts'), timeout_milliseconds := 120000);
  end if;
end $$;
