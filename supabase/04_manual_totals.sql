-- ============================================================================
-- 04_manual_totals.sql
-- ----------------------------------------------------------------------------
-- CARRIED-OVER (MANUAL) PLAYER STATS
--
-- Run this ONCE in the Supabase SQL Editor, AFTER 01, 02 and 03.
-- It only ADDS a new table. It does not touch, rewrite or delete anything you
-- already have, and it is safe to run twice.
--
-- WHY THIS EXISTS
--   Your team played for months before you started logging matches here. Those
--   numbers still count. This table stores them as one flat starting total per
--   player, which the app adds on top of the real logged matches:
--
--       Manual (20 kills)  +  Logged (35 kills)  =  Total (55 kills)
--
--   Nothing here is ever recalculated by the app. These are numbers YOU type,
--   and they stay exactly as typed until you change them.
--
-- HOW THE TWO KINDS OF ROW WORK
--   map_id IS NULL      -> the player's overall carry-over totals
--   map_id IS NOT NULL  -> carry-over totals for that one map
--
--   Keeping both in one table means one set of permissions and one place to
--   look. A map row simply leaves the columns it does not use at 0.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. THE TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.player_manual_stats (
  id                   uuid primary key default gen_random_uuid(),
  player_id            uuid not null references public.players(id) on delete cascade,

  -- NULL = this row is the player's overall carry-over total.
  -- Set   = this row is the carry-over total for that one map.
  map_id               uuid references public.maps(id) on delete cascade,

  -- Core counting stats. Every one of these is simply added to the logged
  -- numbers, so they must never be negative.
  matches              int not null default 0 check (matches              >= 0),
  finishes             int not null default 0 check (finishes             >= 0),
  knocks               int not null default 0 check (knocks               >= 0),
  assists              int not null default 0 check (assists              >= 0),
  damage               int not null default 0 check (damage               >= 0),
  headshots            int not null default 0 check (headshots            >= 0),
  revives              int not null default 0 check (revives              >= 0),
  wwcd                 int not null default 0 check (wwcd                 >= 0),
  top10                int not null default 0 check (top10                >= 0),
  mvps                 int not null default 0 check (mvps                 >= 0),
  throwable_damage     int not null default 0 check (throwable_damage     >= 0),
  vehicle_kills        int not null default 0 check (vehicle_kills        >= 0),

  -- Survival is entered as an AVERAGE (mm:ss) because that is what the game
  -- shows you. The app turns it into a total when it merges:
  --     total seconds = avg_survival_seconds x matches
  avg_survival_seconds int not null default 0 check (avg_survival_seconds >= 0),

  -- A record, not a sum. The app takes the HIGHER of manual and logged.
  longest_kill         numeric(6,1) not null default 0 check (longest_kill >= 0),

  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. ONE ROW PER PLAYER, AND ONE ROW PER PLAYER PER MAP
-- ----------------------------------------------------------------------------
-- Two partial indexes instead of one plain UNIQUE, because in SQL two NULLs
-- are not considered equal - a plain unique (player_id, map_id) would happily
-- let a player have five "overall" rows.
create unique index if not exists player_manual_overall_uq
  on public.player_manual_stats (player_id)
  where map_id is null;

create unique index if not exists player_manual_map_uq
  on public.player_manual_stats (player_id, map_id)
  where map_id is not null;

create index if not exists player_manual_player_idx
  on public.player_manual_stats (player_id);

-- ----------------------------------------------------------------------------
-- 3. PERMISSIONS (Row Level Security)
-- ----------------------------------------------------------------------------
-- Everyone signed in can READ carry-over stats - they are part of the numbers
-- shown on every page.
-- Only STAFF (Owner, Admin, Coach, Analyst) can WRITE them.
--
-- This is the rule that matters: a Player can still edit their own profile
-- card, but the database itself refuses any attempt by them to change their
-- own stats, even if they bypass the website and call the API directly.
-- ----------------------------------------------------------------------------
alter table public.player_manual_stats enable row level security;

drop policy if exists "read player_manual_stats"         on public.player_manual_stats;
drop policy if exists "staff insert player_manual_stats" on public.player_manual_stats;
drop policy if exists "staff update player_manual_stats" on public.player_manual_stats;
drop policy if exists "staff delete player_manual_stats" on public.player_manual_stats;

create policy "read player_manual_stats" on public.player_manual_stats
  for select to authenticated using (true);

create policy "staff insert player_manual_stats" on public.player_manual_stats
  for insert to authenticated with check (public.is_staff());

create policy "staff update player_manual_stats" on public.player_manual_stats
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "staff delete player_manual_stats" on public.player_manual_stats
  for delete to authenticated using (public.is_staff());

-- ----------------------------------------------------------------------------
-- 4. KEEP updated_at FRESH
-- ----------------------------------------------------------------------------
drop trigger if exists touch_player_manual_stats on public.player_manual_stats;
create trigger touch_player_manual_stats
  before update on public.player_manual_stats
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. ACTIVITY LOG
-- ----------------------------------------------------------------------------
-- The shared log_activity() trigger looks for a name on the row to describe
-- it. This table has no name of its own, only a player_id, so it gets its own
-- small version that reads the player's IGN and says which map was touched.
-- ----------------------------------------------------------------------------
create or replace function public.log_manual_stats()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row    jsonb;
  v_actor  text;
  v_role   app_role;
  v_ign    text;
  v_map    text;
  v_verb   text;
begin
  if coalesce(current_setting('app.skip_audit', true), 'off') = 'on' then
    return null;
  end if;

  v_row := to_jsonb(coalesce(new, old));

  select coalesce(p.full_name, p.email, 'Someone'), p.role
    into v_actor, v_role
    from public.profiles p where p.id = auth.uid();

  select ign into v_ign
    from public.players where id = (v_row ->> 'player_id')::uuid;

  if (v_row ->> 'map_id') is not null then
    select name into v_map from public.maps where id = (v_row ->> 'map_id')::uuid;
  end if;

  v_verb := case tg_op when 'INSERT' then 'added'
                       when 'UPDATE' then 'edited'
                       else 'cleared' end;

  insert into public.activity_log
    (actor_id, actor_name, actor_role, action, entity, entity_id, summary)
  values
    (auth.uid(), coalesce(v_actor, 'System'), v_role, lower(tg_op),
     'player_manual_stats', v_row ->> 'id',
     format('%s %s carried-over stats for %s%s',
            coalesce(v_actor, 'System'),
            v_verb,
            coalesce(v_ign, 'a player'),
            case when v_map is null then '' else ' on ' || v_map end));

  return null;
end $$;

drop trigger if exists audit_player_manual_stats on public.player_manual_stats;
create trigger audit_player_manual_stats
  after insert or update or delete on public.player_manual_stats
  for each row execute function public.log_manual_stats();

-- ----------------------------------------------------------------------------
-- 6. REALTIME
-- ----------------------------------------------------------------------------
-- So that when the coach saves carry-over stats on their laptop, every other
-- open screen updates without anyone pressing refresh.
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.player_manual_stats;
  exception when duplicate_object then null;  -- already added, ignore
  end;
end $$;

-- ============================================================================
-- Done. Nothing else needs running - reload the website and the new
-- "Overall Stats" and "Map Stats" tabs will appear in the player modal
-- for Owners, Admins, Coaches and Analysts.
-- ============================================================================
