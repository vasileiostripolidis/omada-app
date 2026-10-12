-- ============ Ομάδα: βασικό σχήμα ============
create extension if not exists pg_cron;

-- Προφίλ χρηστών (διαχειριστές / προπονητές)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'pending' check (role in ('admin','coach','pending')),
  created_at timestamptz default now()
);

-- Ρυθμίσεις συλλόγου (μία γραμμή)
create table public.club_settings (
  id int primary key default 1 check (id = 1),
  club_name text not null default 'Η Ομάδα μου',
  logo_url text,
  address text,
  phone text,
  email text,
  iban text,
  default_monthly_fee numeric(10,2) not null default 30,
  sibling_discount_pct numeric(5,2) not null default 10,
  charge_day int not null default 1 check (charge_day between 1 and 28),
  due_days int not null default 10,
  auto_charges boolean not null default true,
  auto_email_charges boolean not null default false,
  email_footer text default 'Ευχαριστούμε για τη συνεργασία!',
  primary_color text default '#0f7a3d'
);
insert into public.club_settings (id) values (1);

-- Τμήματα / ομάδες
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age_group text,
  season text default to_char(now(),'YYYY') || '-' || to_char(now() + interval '1 year','YY'),
  coach_name text,
  color text default '#0f7a3d',
  training_schedule text,
  monthly_fee numeric(10,2),
  created_at timestamptz default now()
);

-- Παίκτες
create table public.players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birth_date date,
  photo_path text,
  team_id uuid references public.teams(id) on delete set null,
  jersey_number int,
  position text,
  guardian_name text,
  guardian_email text,
  guardian_phone text,
  guardian2_name text,
  guardian2_phone text,
  address text,
  amka text,
  medical_expiry date,
  medical_notes text,
  family_code text,
  monthly_fee numeric(10,2),
  discount_pct numeric(5,2) default 0,
  active boolean not null default true,
  notes text,
  joined_at date default current_date,
  created_at timestamptz default now()
);
create index on public.players(team_id);
create index on public.players(family_code);

-- Αρχεία παικτών (ιατρικές, ταυτότητες, φωτογραφίες, έγγραφα)
create table public.player_files (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  name text not null,
  path text not null,
  mime text,
  size bigint,
  kind text default 'other' check (kind in ('medical','id','photo','consent','other')),
  uploaded_at timestamptz default now()
);
create index on public.player_files(player_id);

-- Χρεώσεις
create table public.charges (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  period date,
  description text not null,
  amount numeric(10,2) not null,
  due_date date,
  status text not null default 'pending' check (status in ('pending','paid','partial','cancelled')),
  paid_amount numeric(10,2) not null default 0,
  auto boolean default false,
  emailed_at timestamptz,
  created_at timestamptz default now()
);
create index on public.charges(player_id);
create unique index charges_auto_unique on public.charges(player_id, period) where auto;

-- Πληρωμές
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid references public.charges(id) on delete set null,
  player_id uuid not null references public.players(id) on delete cascade,
  amount numeric(10,2) not null,
  method text default 'cash' check (method in ('cash','bank','card','other')),
  paid_at date default current_date,
  note text,
  created_at timestamptz default now()
);
create index on public.payments(player_id);

-- Ενημέρωση κατάστασης χρέωσης όταν μπαίνει/σβήνεται πληρωμή
create or replace function public.recalc_charge() returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid := coalesce(new.charge_id, old.charge_id);
begin
  if cid is not null then
    update charges c set paid_amount = coalesce((select sum(amount) from payments where charge_id = cid),0),
      status = case when c.status='cancelled' then 'cancelled'
                    when coalesce((select sum(amount) from payments where charge_id = cid),0) >= c.amount then 'paid'
                    when coalesce((select sum(amount) from payments where charge_id = cid),0) > 0 then 'partial'
                    else 'pending' end
    where c.id = cid;
  end if;
  return null;
end $$;
create trigger payments_recalc after insert or update or delete on public.payments
for each row execute function public.recalc_charge();

-- Αγώνες / προπονήσεις
create table public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  type text not null default 'match' check (type in ('match','training','tournament','other')),
  starts_at timestamptz not null,
  opponent text,
  location text,
  home boolean default true,
  score_for int,
  score_against int,
  notes text,
  created_at timestamptz default now()
);
create index on public.events(team_id, starts_at);

-- Στατιστικά / παρουσίες ανά παίκτη ανά γεγονός
create table public.player_stats (
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  present boolean default true,
  minutes int default 0,
  goals int default 0,
  assists int default 0,
  yellow int default 0,
  red int default 0,
  rating numeric(3,1),
  primary key (event_id, player_id)
);

-- Ιστορικό email
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text,
  subject text,
  kind text,
  player_id uuid references public.players(id) on delete set null,
  status text,
  error text,
  sent_at timestamptz default now()
);

-- ============ Ρόλοι & ασφάλεια ============
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','coach'));
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Ο πρώτος χρήστης γίνεται αυτόματα διαχειριστής, οι επόμενοι περιμένουν έγκριση
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          case when exists (select 1 from profiles where role='admin') then 'pending' else 'admin' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.club_settings enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.player_files enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.events enable row level security;
alter table public.player_stats enable row level security;
alter table public.email_log enable row level security;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "admin manage profiles" on public.profiles for update to authenticated using (public.is_admin());
create policy "admin delete profiles" on public.profiles for delete to authenticated using (public.is_admin());

create policy "staff read settings" on public.club_settings for select to authenticated using (public.is_staff());
create policy "admin write settings" on public.club_settings for update to authenticated using (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['teams','players','player_files','charges','payments','events','player_stats','email_log'] loop
    execute format('create policy "staff all %1$s" on public.%1$I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- ============ Αποθήκευση αρχείων ============
insert into storage.buckets (id, name, public) values ('player-files','player-files', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('club','club', true) on conflict do nothing;
create policy "staff files all" on storage.objects for all to authenticated
  using (bucket_id in ('player-files','club') and public.is_staff())
  with check (bucket_id in ('player-files','club') and public.is_staff());

-- ============ Αυτόματες μηνιαίες χρεώσεις ============
create or replace function public.generate_monthly_charges(p_period date default date_trunc('month', current_date)::date)
returns int language plpgsql security definer set search_path = public as $$
declare s club_settings; n int;
begin
  if auth.uid() is not null and not public.is_staff() then raise exception 'not allowed'; end if;
  select * into s from club_settings where id = 1;
  with fam as (
    select id, family_code,
           row_number() over (partition by family_code order by birth_date nulls last, created_at) rn
    from players where active
  )
  insert into charges (player_id, period, description, amount, due_date, auto)
  select p.id, p_period,
         'Συνδρομή ' || to_char(p_period, 'MM/YYYY'),
         round(coalesce(p.monthly_fee, t.monthly_fee, s.default_monthly_fee)
               * (1 - coalesce(p.discount_pct,0)/100)
               * (case when p.family_code is not null and f.rn > 1 then 1 - s.sibling_discount_pct/100 else 1 end), 2),
         p_period + (s.due_days || ' days')::interval,
         true
  from players p
  join fam f on f.id = p.id
  left join teams t on t.id = p.team_id
  where p.active
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Τρέχει καθημερινά 06:00 UTC· δημιουργεί χρεώσεις τη μέρα χρέωσης του μήνα
create or replace function public.cron_monthly_charges() returns void language plpgsql security definer set search_path = public as $$
declare s club_settings;
begin
  select * into s from club_settings where id = 1;
  if s.auto_charges and extract(day from current_date) = s.charge_day then
    perform generate_monthly_charges(date_trunc('month', current_date)::date);
  end if;
end $$;
select cron.schedule('omada-monthly-charges', '0 6 * * *', $$select public.cron_monthly_charges()$$);

-- Προβολή υπολοίπων
create or replace view public.player_balances with (security_invoker = true) as
select p.id as player_id,
       coalesce(sum(c.amount) filter (where c.status <> 'cancelled'),0) as total_charged,
       coalesce(sum(c.paid_amount) filter (where c.status <> 'cancelled'),0) as total_paid,
       coalesce(sum(c.amount - c.paid_amount) filter (where c.status in ('pending','partial')),0) as balance,
       count(*) filter (where c.status in ('pending','partial') and c.due_date < current_date) as overdue_count
from players p left join charges c on c.player_id = p.id
group by p.id;
