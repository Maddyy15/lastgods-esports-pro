-- ============================================================================
-- LastGods Esports  |  01_schema.sql
-- Run this FIRST in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run
-- Creates: enums, tables, helper functions, auto-calculation triggers,
--          activity logging, storage buckets and realtime.
-- Safe to re-run: everything uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUM TYPES (fixed lists of allowed values)
-- ---------------------------------------------------------------------------
do $$
begin
  -- Website permission levels
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('owner','admin','coach','analyst','player','viewer');
  end if;
  -- Roster status of a player
  if not exists (select 1 from pg_type where typname = 'player_status') then
    create type player_status as enum ('active','substitute','trial','inactive');
  end if;
  -- BGMI in-game roles
  if not exists (select 1 from pg_type where typname = 'game_role') then
    create type game_role as enum ('igl','assaulter','support','sniper','filler');
  end if;
  if not exists (select 1 from pg_type where typname = 'match_kind') then
    create type match_kind as enum ('scrim','tournament','practice','ranked');
  end if;
  -- Which part of the match we were eliminated in
  if not exists (select 1 from pg_type where typname = 'game_phase') then
    create type game_phase as enum ('early','mid','late','survived');
  end if;
  if not exists (select 1 from pg_type where typname = 'tournament_status') then
    create type tournament_status as enum ('upcoming','ongoing','completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'event_kind') then
    create type event_kind as enum ('scrim','tournament','practice','meeting');
  end if;
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type attendance_status as enum ('available','not_available','maybe');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. TEAM SETTINGS (a single row, id is always 1)
-- ---------------------------------------------------------------------------
create table if not exists public.team_settings (
  id                    int primary key default 1 check (id = 1),
  team_name             text not null default 'LastGods Esports',
  tagline               text default 'Drop. Dominate. Repeat.',
  logo_url              text,
  accent_color          text not null default '#f59e0b',
  -- When false, the dashboard shows manual_totals instead of calculated ones
  auto_calculate_totals boolean not null default true,
  manual_totals         jsonb not null default '{}'::jsonb,
  -- BGMI esports placement points. Key = placement, value = points.
  points_table          jsonb not null default
      '{"1":10,"2":6,"3":5,"4":4,"5":3,"6":2,"7":1,"8":1}'::jsonb,
  -- Weights used by the 0-100 Player Rating formula (should add up to 100)
  rating_weights        jsonb not null default
      '{"finishes":30,"damage":25,"assists":10,"survival":20,"revives":15}'::jsonb,
  updated_at            timestamptz not null default now()
);
insert into public.team_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. PROFILES - one row per logged-in user, holds their permission level.
--    Linked 1:1 with Supabase's built-in auth.users table.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       app_role not null default 'viewer',
  avatar_url text,
  player_id  uuid,          -- optional link to a roster player (FK added below)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS
--    SECURITY DEFINER = the function runs with its owner's rights, so it can
--    read profiles without re-triggering the profiles RLS policy (which would
--    cause infinite recursion).
-- ---------------------------------------------------------------------------
create or replace function public.my_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('owner','admin'), false);
$$;

-- Staff = anyone allowed to enter match / player data
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('owner','admin','coach','analyst'), false);
$$;

-- The roster player linked to the logged-in user (null for staff / viewers)
create or replace function public.my_player_id()
returns uuid language sql stable security definer set search_path = public as $$
  select player_id from public.profiles where id = auth.uid();
$$;

-- Generic "touch updated_at on every UPDATE" trigger function
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 5. MAPS + DROP SPOTS
-- ---------------------------------------------------------------------------
create table if not exists public.maps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  image_url  text,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.drop_spots (
  id         uuid primary key default gen_random_uuid(),
  map_id     uuid not null references public.maps(id) on delete cascade,
  name       text not null,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (map_id, name)
);
create index if not exists drop_spots_map_idx on public.drop_spots(map_id);

-- ---------------------------------------------------------------------------
-- 6. PLAYERS (the roster)
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id                uuid primary key default gen_random_uuid(),
  ign               text not null unique,          -- in-game name
  real_name         text,
  character_id      text,                          -- BGMI numeric character ID
  primary_role      game_role not null default 'filler',
  secondary_role    game_role,
  status            player_status not null default 'active',
  photo_url         text,
  device            text,                          -- phone model
  fps_setting       text,                          -- e.g. "90 FPS / Smooth"
  gyro              boolean not null default true,
  sensitivity_notes text,
  preferred_ar      text,
  preferred_dmr     text,
  bio               text,
  socials           jsonb not null default '{}'::jsonb,  -- {"instagram":"..."}
  join_date         date default current_date,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Now that players exists, link profiles.player_id to it
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_player_id_fkey') then
    alter table public.profiles
      add constraint profiles_player_id_fkey
      foreign key (player_id) references public.players(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. TOURNAMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.tournaments (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  organizer      text,
  tier           text,                     -- Official / Third-party / Scrim league
  start_date     date,
  end_date       date,
  format         text,
  prize_pool     numeric(12,2),
  final_position int,
  prize_won      numeric(12,2),
  status         tournament_status not null default 'upcoming',
  logo_url       text,
  notes          text,
  -- Optional per-tournament placement points, overrides team_settings
  points_table   jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Other teams' points, so we can see where we stand inside a tournament
create table if not exists public.tournament_standings (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  team_name      text not null,
  is_us          boolean not null default false,
  placement_pts  int not null default 0,
  finish_pts     int not null default 0,
  total_pts      int generated always as (placement_pts + finish_pts) stored,
  matches_played int not null default 0,
  wwcd           int not null default 0,
  unique (tournament_id, team_name)
);

-- ---------------------------------------------------------------------------
-- 8. OPPONENTS (scouting)
-- ---------------------------------------------------------------------------
create table if not exists public.opponents (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  tag             text,
  logo_url        text,
  roster          text,                 -- their player IGNs, comma separated
  playstyle_notes text,
  threat_level    int not null default 3 check (threat_level between 1 and 5),
  we_eliminated   int not null default 0,  -- manually tracked by the coach
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Where each opponent usually drops, per map
create table if not exists public.opponent_spots (
  id          uuid primary key default gen_random_uuid(),
  opponent_id uuid not null references public.opponents(id) on delete cascade,
  map_id      uuid not null references public.maps(id) on delete cascade,
  spot_name   text not null,
  notes       text
);

-- ---------------------------------------------------------------------------
-- 9. MATCHES - the heart of the whole app
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id                uuid primary key default gen_random_uuid(),
  played_at         timestamptz not null default now(),
  match_type        match_kind not null default 'scrim',
  tournament_id     uuid references public.tournaments(id) on delete set null,
  scrim_name        text,                -- used when there is no tournament
  stage             text,                -- Qualifiers / League / Semi-Finals / Grand Finals
  day_number        int,
  match_number      int,
  map_id            uuid not null references public.maps(id) on delete restrict,
  drop_spot_id      uuid references public.drop_spots(id) on delete set null,
  placement         int not null check (placement between 1 and 100),
  teams_in_lobby    int not null default 16,
  contested         boolean not null default false,
  contested_against text,
  zone_side         text,                -- side of the first circle
  rotation_timing   text,                -- early / on-time / late
  eliminated_by     text,
  eliminated_phase  game_phase,
  vod_url           text,
  screenshot_url    text,
  coach_notes       text,

  -- ---- Filled in automatically by the recalc trigger, never typed by hand ---
  placement_points  int not null default 0,
  finish_points     int not null default 0,
  total_points      int not null default 0,
  team_finishes     int not null default 0,
  team_damage       int not null default 0,
  is_wwcd           boolean generated always as (placement = 1) stored,

  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists matches_played_at_idx  on public.matches(played_at desc);
create index if not exists matches_map_idx        on public.matches(map_id);
create index if not exists matches_tournament_idx on public.matches(tournament_id);
create index if not exists matches_drop_spot_idx  on public.matches(drop_spot_id);

-- ---------------------------------------------------------------------------
-- 10. MATCH PLAYER STATS - one row per player per match.
--     Every map-wise / filtered statistic in the app is calculated from here,
--     which is why nothing is ever stored as a pre-summed "total" we can't trust.
-- ---------------------------------------------------------------------------
create table if not exists public.match_player_stats (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null references public.matches(id) on delete cascade,
  player_id        uuid not null references public.players(id) on delete cascade,
  finishes         int not null default 0 check (finishes         >= 0),
  knocks           int not null default 0 check (knocks           >= 0),
  assists          int not null default 0 check (assists          >= 0),
  damage           int not null default 0 check (damage           >= 0),
  headshots        int not null default 0 check (headshots        >= 0),
  revives          int not null default 0 check (revives          >= 0),
  survival_seconds int not null default 0 check (survival_seconds >= 0),
  throwable_damage int not null default 0 check (throwable_damage >= 0),
  utility_used     int not null default 0 check (utility_used     >= 0),
  vehicle_kills    int not null default 0 check (vehicle_kills    >= 0),
  longest_kill     numeric(6,1) not null default 0 check (longest_kill >= 0),
  heals_used       int not null default 0 check (heals_used       >= 0),
  boosts_used      int not null default 0 check (boosts_used      >= 0),
  is_mvp           boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  unique (match_id, player_id)
);
create index if not exists mps_match_idx  on public.match_player_stats(match_id);
create index if not exists mps_player_idx on public.match_player_stats(player_id);

-- ---------------------------------------------------------------------------
-- 11. SCHEDULE + ATTENDANCE
-- ---------------------------------------------------------------------------
create table if not exists public.schedule_events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  event_type    event_kind not null default 'scrim',
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  tournament_id uuid references public.tournaments(id) on delete set null,
  location      text,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists schedule_starts_idx on public.schedule_events(starts_at);

create table if not exists public.attendance (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.schedule_events(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  status     attendance_status not null default 'maybe',
  note       text,
  updated_at timestamptz not null default now(),
  unique (event_id, player_id)
);

-- ---------------------------------------------------------------------------
-- 12. STRATEGY NOTES + ANNOUNCEMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.strategy_notes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text,
  map_id       uuid references public.maps(id) on delete set null,
  drop_spot_id uuid references public.drop_spots(id) on delete set null,
  tags         text[] not null default '{}',
  is_pinned    boolean not null default false,
  author_id    uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  is_pinned  boolean not null default false,
  author_id  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 13. ACTIVITY LOG - "who changed what, and when"
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  actor_name text,
  actor_role app_role,
  action     text not null,              -- insert / update / delete
  entity     text not null,              -- table name
  entity_id  text,
  summary    text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_created_idx on public.activity_log(created_at desc);

-- ============================================================================
-- 14. AUTOMATIC POINTS + STAT RECALCULATION
-- ============================================================================

-- Look up placement points from a jsonb points table.
-- Placements not listed (9th and below by default) score 0.
create or replace function public.placement_points_for(p_placement int, p_table jsonb)
returns int language plpgsql immutable as $$
begin
  if p_table is null then
    p_table := '{"1":10,"2":6,"3":5,"4":4,"5":3,"6":2,"7":1,"8":1}'::jsonb;
  end if;
  return coalesce((p_table ->> p_placement::text)::int, 0);
end $$;

-- Recalculate one match: placement points, finish points, total points and
-- the team finish/damage summary. Called by every trigger below.
create or replace function public.recalc_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_match   record;
  v_table   jsonb;
  v_finish  int;
  v_damage  int;
  v_place   int;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then return; end if;

  -- A tournament may use its own points format; otherwise use the team default
  select coalesce(t.points_table, s.points_table)
    into v_table
    from public.team_settings s
    left join public.tournaments t on t.id = v_match.tournament_id
   where s.id = 1;

  select coalesce(sum(finishes), 0), coalesce(sum(damage), 0)
    into v_finish, v_damage
    from public.match_player_stats where match_id = p_match_id;

  v_place := public.placement_points_for(v_match.placement, v_table);

  -- Tell the activity logger to ignore the UPDATE we are about to make.
  -- Without this, saving one match with five players would write seven
  -- "edited matches" entries to the activity log instead of one.
  -- The third argument (true) makes the setting last only for this transaction.
  perform set_config('app.skip_audit', 'on', true);

  -- NOTE: this UPDATE only touches calculated columns, and the AFTER UPDATE
  -- trigger below only fires when placement/tournament change, so no recursion.
  update public.matches
     set placement_points = v_place,
         finish_points    = v_finish,
         total_points     = v_place + v_finish,
         team_finishes    = v_finish,
         team_damage      = v_damage
   where id = p_match_id;

  perform set_config('app.skip_audit', 'off', true);
end $$;

-- Trigger wrapper for the matches table
create or replace function public.trg_recalc_self()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_match(new.id);
  return null;
end $$;

-- Trigger wrapper for match_player_stats (recalculates the parent match)
create or replace function public.trg_recalc_parent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_match(coalesce(new.match_id, old.match_id));
  return null;
end $$;

drop trigger if exists matches_recalc_ins on public.matches;
create trigger matches_recalc_ins
  after insert on public.matches
  for each row execute function public.trg_recalc_self();

drop trigger if exists matches_recalc_upd on public.matches;
create trigger matches_recalc_upd
  after update on public.matches
  for each row
  when (old.placement is distinct from new.placement
     or old.tournament_id is distinct from new.tournament_id)
  execute function public.trg_recalc_self();

drop trigger if exists mps_recalc on public.match_player_stats;
create trigger mps_recalc
  after insert or update or delete on public.match_player_stats
  for each row execute function public.trg_recalc_parent();

-- ============================================================================
-- 15. ACTIVITY LOGGING TRIGGER
-- ============================================================================
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name  text;
  v_role  app_role;
  v_row   jsonb;
  v_label text;
  v_verb  text;
begin
  -- Skip the automatic recalculation updates (see recalc_match above)
  if coalesce(current_setting('app.skip_audit', true), 'off') = 'on' then
    return null;
  end if;

  select coalesce(p.full_name, p.email, 'Someone'), p.role
    into v_name, v_role
    from public.profiles p where p.id = auth.uid();

  v_row := to_jsonb(coalesce(new, old));

  -- Pick the most human-readable field available on that row
  v_label := coalesce(v_row ->> 'ign', v_row ->> 'name', v_row ->> 'title',
                      v_row ->> 'team_name',
                      'match #' || coalesce(v_row ->> 'match_number', '?'));

  v_verb := case tg_op when 'INSERT' then 'added'
                       when 'UPDATE' then 'edited'
                       else 'deleted' end;

  insert into public.activity_log
    (actor_id, actor_name, actor_role, action, entity, entity_id, summary)
  values
    (auth.uid(), coalesce(v_name, 'System'), v_role, lower(tg_op),
     tg_table_name, v_row ->> 'id',
     format('%s %s %s in %s', coalesce(v_name, 'System'), v_verb, v_label, tg_table_name));

  return null;
end $$;

-- Attach the audit trigger to every table worth tracking.
-- (match_player_stats is skipped on purpose - it would be far too noisy,
--  since the parent match row already records the change.)
do $$
declare t text;
begin
  foreach t in array array['players','matches','tournaments','opponents',
                           'strategy_notes','announcements','schedule_events',
                           'maps','drop_spots','team_settings','profiles']
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$s
         for each row execute function public.log_activity()', t);
  end loop;
end $$;

-- Keep updated_at fresh everywhere it exists
do $$
declare t text;
begin
  foreach t in array array['players','matches','tournaments','opponents',
                           'strategy_notes','announcements','schedule_events',
                           'attendance','team_settings','profiles']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- 16. NEW USER -> PROFILE
--     Whenever an account is created in Supabase Auth, make a profile row.
--     The very first account ever created automatically becomes the OWNER.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  select count(*) into v_count from public.profiles;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case
      when v_count = 0 then 'owner'::app_role
      -- An admin can preset the role when inviting: user metadata {"role":"coach"}
      when new.raw_user_meta_data ->> 'role' is not null
        then (new.raw_user_meta_data ->> 'role')::app_role
      else 'viewer'::app_role
    end
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 17. GUARD RAILS
--     The UI hides buttons, but these rules are what actually stop someone
--     from editing what they shouldn't - even using the API directly.
-- ============================================================================

-- Nobody can promote themselves. Only an admin can change roles / links.
create or replace function public.guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.player_id is distinct from old.player_id)
     and not public.is_admin() then
    raise exception 'Only an Owner or Admin can change a permission level.';
  end if;
  return new;
end $$;

drop trigger if exists guard_profiles on public.profiles;
create trigger guard_profiles
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- A player may edit their own card, but not their roster role or status.
create or replace function public.guard_player_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    if new.ign            is distinct from old.ign
    or new.primary_role   is distinct from old.primary_role
    or new.secondary_role is distinct from old.secondary_role
    or new.status         is distinct from old.status then
      raise exception 'Players can edit their own details, but not their IGN, role or status.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_players on public.players;
create trigger guard_players
  before update on public.players
  for each row execute function public.guard_player_changes();

-- ============================================================================
-- 18. STORAGE BUCKETS (player photos, match screenshots, team logo)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('avatars','avatars',true),
       ('screenshots','screenshots',true),
       ('branding','branding',true)
on conflict (id) do nothing;

drop policy if exists "team files are readable" on storage.objects;
create policy "team files are readable" on storage.objects
  for select using (bucket_id in ('avatars','screenshots','branding'));

drop policy if exists "team can upload files" on storage.objects;
create policy "team can upload files" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars','screenshots','branding'));

drop policy if exists "team can replace files" on storage.objects;
create policy "team can replace files" on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars','screenshots','branding'));

drop policy if exists "staff can delete files" on storage.objects;
create policy "staff can delete files" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars','screenshots','branding') and public.is_staff());

-- ============================================================================
-- 19. REALTIME - so a match saved on one phone appears on everyone's screen
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['matches','match_player_stats','players','announcements',
                           'activity_log','schedule_events','attendance',
                           'strategy_notes','tournaments','team_settings']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;  -- already added, ignore
    end;
  end loop;
end $$;

-- Done. Next: run 02_rls.sql
