-- ============================================================================
-- LastGods Esports  |  02_rls.sql
-- Run this SECOND (after 01_schema.sql).
--
-- Row Level Security (RLS) is the real security of this app. The React UI
-- hides buttons people shouldn't press, but these policies are what actually
-- stop a Player from deleting a match - even if they used the API directly.
--
-- The rules in plain English:
--   Everyone logged in      -> can READ everything
--   Owner / Admin           -> can do anything
--   Coach / Analyst (staff) -> can add + edit matches, players, tournaments, notes
--   Player                  -> can edit their own player card + their own availability
--   Viewer                  -> read only
--   Nobody logged out       -> sees nothing at all
-- ============================================================================

-- Turn RLS ON for every table. Without this line, policies are ignored.
alter table public.profiles             enable row level security;
alter table public.team_settings        enable row level security;
alter table public.maps                 enable row level security;
alter table public.drop_spots           enable row level security;
alter table public.players              enable row level security;
alter table public.tournaments          enable row level security;
alter table public.tournament_standings enable row level security;
alter table public.opponents            enable row level security;
alter table public.opponent_spots       enable row level security;
alter table public.matches              enable row level security;
alter table public.match_player_stats   enable row level security;
alter table public.schedule_events      enable row level security;
alter table public.attendance           enable row level security;
alter table public.strategy_notes       enable row level security;
alter table public.announcements        enable row level security;
alter table public.activity_log         enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: drop every existing policy on our tables so this file can be re-run
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('profiles','team_settings','maps','drop_spots','players',
                         'tournaments','tournament_standings','opponents','opponent_spots',
                         'matches','match_player_stats','schedule_events','attendance',
                         'strategy_notes','announcements','activity_log')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 1. READ ACCESS - every logged-in team member can read every table.
--    `to authenticated` means anonymous visitors get nothing.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','team_settings','maps','drop_spots','players',
                           'tournaments','tournament_standings','opponents','opponent_spots',
                           'matches','match_player_stats','schedule_events','attendance',
                           'strategy_notes','announcements','activity_log']
  loop
    execute format(
      'create policy "read %1$s" on public.%1$s for select to authenticated using (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. STAFF TABLES - Owner, Admin, Coach and Analyst can write.
--    (Matches, players stats, tournaments, scouting, notes, schedule.)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['matches','match_player_stats','tournaments',
                           'tournament_standings','opponents','opponent_spots',
                           'strategy_notes','announcements','schedule_events']
  loop
    execute format('create policy "staff insert %1$s" on public.%1$s
                      for insert to authenticated with check (public.is_staff())', t);
    execute format('create policy "staff update %1$s" on public.%1$s
                      for update to authenticated using (public.is_staff())
                      with check (public.is_staff())', t);
    execute format('create policy "staff delete %1$s" on public.%1$s
                      for delete to authenticated using (public.is_staff())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. ADMIN-ONLY TABLES - maps, drop spots and team settings shape the whole
--    app, so only an Owner/Admin may change them.
--    (Coaches can still ADD a drop spot, because they need it while logging
--     a match - but they cannot delete one.)
-- ---------------------------------------------------------------------------
create policy "admin insert maps" on public.maps
  for insert to authenticated with check (public.is_admin());
create policy "admin update maps" on public.maps
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete maps" on public.maps
  for delete to authenticated using (public.is_admin());

create policy "staff insert drop_spots" on public.drop_spots
  for insert to authenticated with check (public.is_staff());
create policy "staff update drop_spots" on public.drop_spots
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "admin delete drop_spots" on public.drop_spots
  for delete to authenticated using (public.is_admin());

create policy "admin update settings" on public.team_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. PLAYERS - admins manage the roster; a player may edit their own card.
--    Which FIELDS a player may change is enforced by the guard_player_changes
--    trigger in 01_schema.sql (they cannot change their IGN, role or status).
-- ---------------------------------------------------------------------------
create policy "admin insert players" on public.players
  for insert to authenticated with check (public.is_admin());

create policy "staff or self update players" on public.players
  for update to authenticated
  using  (public.is_staff() or id = public.my_player_id())
  with check (public.is_staff() or id = public.my_player_id());

create policy "admin delete players" on public.players
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. PROFILES - you can edit your own name/avatar; only an admin can change
--    anyone's permission level (also enforced by guard_profile_changes).
-- ---------------------------------------------------------------------------
create policy "self or admin update profiles" on public.profiles
  for update to authenticated
  using  (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "admin insert profiles" on public.profiles
  for insert to authenticated with check (public.is_admin() or id = auth.uid());

create policy "admin delete profiles" on public.profiles
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. ATTENDANCE - staff can set anyone's; a player sets their own.
-- ---------------------------------------------------------------------------
create policy "staff or self insert attendance" on public.attendance
  for insert to authenticated
  with check (public.is_staff() or player_id = public.my_player_id());

create policy "staff or self update attendance" on public.attendance
  for update to authenticated
  using  (public.is_staff() or player_id = public.my_player_id())
  with check (public.is_staff() or player_id = public.my_player_id());

create policy "staff delete attendance" on public.attendance
  for delete to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- 7. ACTIVITY LOG - written only by the SECURITY DEFINER trigger (which
--    bypasses RLS), so there is no INSERT policy on purpose. An admin can
--    clear old entries.
-- ---------------------------------------------------------------------------
create policy "admin delete activity" on public.activity_log
  for delete to authenticated using (public.is_admin());

-- Done. Next: run 03_seed.sql (sample data for testing)
