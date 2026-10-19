-- ===== Δεδομένα επίδειξης για τον έλεγχο της Apple (κρυμμένα από το προσωπικό, βλ. 014) =====
do $$
declare
  t uuid := 'de000000-0000-4000-8000-000000000001';
  h1 uuid := 'de000000-0000-4000-8000-000000000011'; h2 uuid := 'de000000-0000-4000-8000-000000000012';
  p1 uuid := 'de000000-0000-4000-8000-000000000021'; p2 uuid := 'de000000-0000-4000-8000-000000000022';
  p3 uuid := 'de000000-0000-4000-8000-000000000023'; p4 uuid := 'de000000-0000-4000-8000-000000000024';
  ps uuid[]; pl uuid; e uuid; d date; i int; m int; k int; per date; amt numeric;
  today date := (now() at time zone 'Europe/Athens')::date;
begin
  if exists (select 1 from teams where id = t) then return; end if;

  insert into teams (id, name, short_name, age_group, season, color, is_demo)
  values (t, 'Ομάδα Επίδειξης U12', 'DEMO', 'U12', (select current_season from club_settings where id = 1), '#c8102e', true);
  insert into training_slots (team_id, weekday, start_time, end_time, location) values
    (t, 2, '18:00', '19:30', 'Γήπεδο επίδειξης'), (t, 4, '18:00', '19:30', 'Γήπεδο επίδειξης');

  insert into households (id, name, is_demo) values (h1, 'Οικογένεια Δοκιμαστική', true), (h2, 'Οικογένεια Παράδειγμα', true);
  insert into guardians (household_id, first_name, last_name, relation, phone, receives_emails) values
    (h1, 'Μαρία', 'Δοκιμαστική', 'Μητέρα', '6900000001', false),
    (h2, 'Γιάννης', 'Παράδειγμα', 'Πατέρας', '6900000002', false);

  insert into players (id, first_name, last_name, birth_date, team_id, jersey_number, position, medical_expiry, card_number, card_expiry, active, joined_at) values
    (p1, 'Νίκος', 'Δοκιμαστικός', '2014-05-12', t, 10, 'Μέσος', today + 200, 'D-1001', today + 300, true, today - 400),
    (p2, 'Ελένη', 'Δοκιμαστική', '2015-09-03', t, 7, 'Επιθετικός', today + 120, 'D-1002', today + 300, true, today - 200),
    (p3, 'Κώστας', 'Παράδειγμα', '2014-02-20', t, 1, 'Τερματοφύλακας', today + 20, 'D-1003', today + 300, true, today - 500),
    (p4, 'Άλεξ', 'Παράδειγμα', '2015-11-30', t, 4, 'Αμυντικός', today - 10, 'D-1004', today + 300, true, today - 100);
  insert into player_households (player_id, household_id, share_pct) values (p1, h1, 100), (p2, h1, 100), (p3, h2, 100), (p4, h2, 100);
  ps := array[p1, p2, p3, p4];
  foreach pl in array ps loop
    insert into consents (player_id, kind, granted, signed_by, source) values
      (pl, 'data', true, 'Γονέας (επίδειξη)', 'demo'), (pl, 'health', true, 'Γονέας (επίδειξη)', 'demo'),
      (pl, 'biometrics', true, 'Γονέας (επίδειξη)', 'demo'), (pl, 'media', true, 'Γονέας (επίδειξη)', 'demo');
  end loop;

  -- Προπονήσεις & αγώνες τελευταίων 4 εβδομάδων (με παρουσίες/στατιστικά) και επόμενων 2 εβδομάδων
  for i in 0..27 loop
    d := today - 28 + i;
    if extract(isodow from d) in (2, 4) then
      e := gen_random_uuid();
      insert into events (id, team_id, type, starts_at, end_at, location, objective)
      values (e, t, 'training', (d + time '18:00') at time zone 'Europe/Athens', (d + time '19:30') at time zone 'Europe/Athens', 'Γήπεδο επίδειξης', 'Κυκλοφορία μπάλας & πίεση');
      k := 0;
      foreach pl in array ps loop
        k := k + 1;
        insert into player_stats (event_id, player_id, present, minutes, rpe) values (e, pl, not (k = 4 and i % 3 = 0), 90, 5 + (i + k) % 4);
      end loop;
    elsif extract(isodow from d) = 6 then
      e := gen_random_uuid();
      insert into events (id, team_id, type, starts_at, end_at, opponent, location, home, score_for, score_against)
      values (e, t, 'match', (d + time '11:00') at time zone 'Europe/Athens', (d + time '12:30') at time zone 'Europe/Athens', 'Αντίπαλος Επίδειξης ' || (i / 7 + 1), 'Γήπεδο επίδειξης', i % 2 = 0, 2 + i % 3, 1 + i % 2);
      insert into player_stats (event_id, player_id, present, minutes, goals, assists, starter, position, rpe) values
        (e, p1, true, 60, 1, 1, true, 'Μέσος', 7), (e, p2, true, 45, 1 + i % 2, 0, false, 'Επιθετικός', 6),
        (e, p3, true, 60, 0, 0, true, 'Τερματοφύλακας', 6), (e, p4, true, 40, 0, 1, true, 'Αμυντικός', 7);
    end if;
  end loop;
  for i in 1..14 loop
    d := today + i;
    if extract(isodow from d) in (2, 4) then
      insert into events (team_id, type, starts_at, end_at, location) values (t, 'training', (d + time '18:00') at time zone 'Europe/Athens', (d + time '19:30') at time zone 'Europe/Athens', 'Γήπεδο επίδειξης');
    elsif extract(isodow from d) = 6 then
      insert into events (team_id, type, starts_at, end_at, opponent, location, home) values (t, 'match', (d + time '11:00') at time zone 'Europe/Athens', (d + time '12:30') at time zone 'Europe/Athens', 'Αντίπαλος Επίδειξης', 'Γήπεδο επίδειξης', true);
    end if;
  end loop;

  -- Μηνιαίες μετρήσεις 4 μηνών με εξέλιξη
  for m in 0..3 loop
    per := (date_trunc('month', today) - make_interval(months => 3 - m))::date;
    k := 0;
    foreach pl in array ps loop
      k := k + 1;
      insert into player_metrics (player_id, period, metric_id, value) values
        (pl, per, 1, 142 + k * 3 + m * 0.6), (pl, per, 2, 35 + k * 2 + m * 0.4),
        (pl, per, 3, round((2.35 - m * 0.04 + k * 0.03)::numeric, 2)), (pl, per, 4, round((4.05 - m * 0.06 + k * 0.04)::numeric, 2)),
        (pl, per, 6, 165 + m * 4 + k * 3), (pl, per, 8, round((11.9 - m * 0.15 + k * 0.1)::numeric, 2)), (pl, per, 9, 520 + m * 80 + k * 40),
        (pl, per, 10, least(10, 6 + (m + k) % 3)), (pl, per, 11, least(10, 5 + (m + k + 1) % 4)), (pl, per, 12, least(10, 5 + m)), (pl, per, 13, least(10, 6 + m % 3)), (pl, per, 15, least(10, 6 + (m + 1) % 3)),
        (pl, per, 16, 8 + m % 2), (pl, per, 17, 8 + (m + k) % 2), (pl, per, 18, 7 + m % 3), (pl, per, 19, 9);
    end loop;
  end loop;
  per := date_trunc('month', today)::date;
  insert into player_evaluations (player_id, period, comment) values
    (p1, per, 'Πολύ καλή εξέλιξη στην κυκλοφορία της μπάλας. Στόχος: περισσότερα σουτ από απόσταση.'),
    (p2, per, 'Εξαιρετική προσπάθεια και ταχύτητα. Να δουλέψει την υποδοχή με το αδύνατο πόδι.'),
    (p3, per, 'Σταθερός κάτω από τα δοκάρια, καλή επικοινωνία με την άμυνα.'),
    (p4, per, 'Καλή τοποθέτηση. Χρειάζεται ανανέωση ιατρικής βεβαίωσης.');
  insert into player_goals (player_id, title, theme, description, target_date, progress, status) values
    (p1, 'Σουτ με το αριστερό πόδι', 'Τεχνική', '20 επαναλήψεις σε κάθε προπόνηση', today + 60, 40, 'active'),
    (p1, 'Ηγετικός ρόλος στο γήπεδο', 'Ψυχολογία / συμπεριφορά', 'Οδηγίες στους συμπαίκτες κατά την ανάπτυξη', today + 90, 25, 'active'),
    (p2, 'Υποδοχή με το αδύνατο πόδι', 'Τεχνική', null, today + 45, 55, 'active');

  insert into announcements (title, body, team_id, pinned) values
    ('Τουρνουά επίδειξης', 'Το Σάββατο η ομάδα συμμετέχει σε φιλικό τουρνουά. Συγκέντρωση 10:15 στο γήπεδο.', t, true),
    ('Νέες εμφανίσεις', 'Οι νέες εμφανίσεις είναι διαθέσιμες στη γραμματεία.', t, false);

  -- Χρεώσεις 2 μηνών και μία πληρωμή
  for m in 0..1 loop
    per := (date_trunc('month', today) - make_interval(months => 1 - m))::date;
    amt := coalesce(household_amount(h1, per), 70);
    insert into charges (household_id, period, description, amount, due_date, auto) values (h1, per, 'Συνδρομή ' || to_char(per, 'MM/YYYY'), amt, per + 10, true);
    amt := coalesce(household_amount(h2, per), 70);
    insert into charges (household_id, period, description, amount, due_date, auto) values (h2, per, 'Συνδρομή ' || to_char(per, 'MM/YYYY'), amt, per + 10, true);
  end loop;
  insert into payments (household_id, amount, method, paid_at, note)
  select h1, amount, 'bank', period + 5, 'Πληρωμή επίδειξης' from charges where household_id = h1 order by period limit 1;
end $$;
