-- ============================================================================
-- LastGods Esports  |  03_seed.sql
-- Run this THIRD. It fills the database with realistic sample data so you can
-- see every page working before you type in a single real match.
--
-- Creates: 5 maps + their drop spots, 5 players (one of each role),
--          2 tournaments, 2 opponent teams, 20 matches with full per-player
--          stats, a schedule, attendance, notes and announcements.
--
-- TO WIPE THE SAMPLE DATA LATER (keeps your maps, players and settings):
--   delete from public.matches;
-- TO WIPE EVERYTHING AND START CLEAN:
--   see the "Clearing sample data" section of README.md
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. MAPS
-- ---------------------------------------------------------------------------
insert into public.maps (name, slug, sort_order) values
  ('Erangel', 'erangel', 1),
  ('Miramar', 'miramar', 2),
  ('Sanhok',  'sanhok',  3),
  ('Vikendi', 'vikendi', 4),
  ('Rondo',   'rondo',   5)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 2. DROP SPOTS (you can add your own later in Settings)
-- ---------------------------------------------------------------------------
insert into public.drop_spots (map_id, name)
select m.id, s.name from public.maps m
join (values
  ('Erangel','Pochinki'), ('Erangel','School'), ('Erangel','Georgopol'),
  ('Erangel','Rozhok'), ('Erangel','Mylta Power'), ('Erangel','Military Base'),
  ('Erangel','Novorepnoye'), ('Erangel','Yasnaya Polyana'),
  ('Miramar','Pecado'), ('Miramar','Hacienda del Patron'), ('Miramar','San Martin'),
  ('Miramar','El Pozo'), ('Miramar','Los Leones'), ('Miramar','Chumacera'),
  ('Miramar','Impala'),
  ('Sanhok','Bootcamp'), ('Sanhok','Paradise Resort'), ('Sanhok','Ruins'),
  ('Sanhok','Camp Bravo'), ('Sanhok','Quarry'), ('Sanhok','Docks'), ('Sanhok','Pai Nan'),
  ('Vikendi','Castle'), ('Vikendi','Cosmodrome'), ('Vikendi','Villa'),
  ('Vikendi','Dino Park'), ('Vikendi','Cement Factory'), ('Vikendi','Goroka'),
  ('Vikendi','Volnova'),
  ('Rondo','Rin Chang'), ('Rondo','Jiuzhen'), ('Rondo','Ulan'),
  ('Rondo','Bamboo Forest'), ('Rondo','Tai Hu'), ('Rondo','Nan Ling'), ('Rondo','Baoshan')
) as s(map_name, name) on s.map_name = m.name
on conflict (map_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- 3. PLAYERS - one of each in-game role
-- ---------------------------------------------------------------------------
insert into public.players
  (ign, real_name, character_id, primary_role, secondary_role, status, device,
   fps_setting, gyro, sensitivity_notes, preferred_ar, preferred_dmr, bio,
   socials, join_date, sort_order)
values
  ('LG-SHADOW','Arjun Mehta','5712008841','igl','support','active',
   'iPhone 15 Pro','90 FPS / Smooth',true,
   'Camera 110 / ADS 85 / Gyro 300 - 6x gyro tuned for shoulder peeks',
   'M416','Mini14','Calls the drops and the rotations. Four years of competitive BGMI.',
   '{"instagram":"lg_shadow","youtube":"@lgshadow"}'::jsonb, '2024-01-15', 1),

  ('LG-REAPER','Dev Sharma','5698123477','assaulter','filler','active',
   'iQOO Neo 9 Pro','90 FPS / Smooth',true,
   'Camera 120 / ADS 95 / Gyro 320 - full gyro, no thumb aim',
   'AKM','SLR','Entry fragger. First through the door, every single time.',
   '{"instagram":"lg_reaper"}'::jsonb, '2024-01-15', 2),

  ('LG-ATLAS','Rohit Nair','5733901256','support','igl','active',
   'OnePlus 12','90 FPS / Smooth',true,
   'Camera 100 / ADS 80 / Gyro 280 - steady for utility throws',
   'M416','QBU','Holds the team together. Smokes, revives and clutch heals.',
   '{"instagram":"lg_atlas"}'::jsonb, '2024-02-02', 3),

  ('LG-HAWK','Karan Bedi','5704558120','sniper','assaulter','active',
   'ROG Phone 8','120 FPS / Smooth',true,
   'Camera 95 / ADS 70 / Gyro 260 - low sens for long range',
   'Beryl M762','AWM','Scouts the zone and opens fights from range.',
   '{"instagram":"lg_hawk","youtube":"@lghawk"}'::jsonb, '2024-03-11', 4),

  ('LG-VIPER','Sahil Khan','5721448903','filler','sniper','substitute',
   'Redmi K70','90 FPS / Smooth',true,
   'Camera 105 / ADS 88 / Gyro 300',
   'M416','SKS','Plays any slot that is missing. The most flexible fragger we have.',
   '{"instagram":"lg_viper"}'::jsonb, '2024-06-20', 5)
on conflict (ign) do nothing;

-- ---------------------------------------------------------------------------
-- 4. TOURNAMENTS
-- ---------------------------------------------------------------------------
insert into public.tournaments
  (name, organizer, tier, start_date, end_date, format, prize_pool,
   final_position, prize_won, status, notes)
values
  ('LastGods Rising Cup 2026','Rising Esports','Third-party',
   '2026-09-12','2026-09-14','16 teams, 8 matches, points format',
   150000, 3, 25000,'completed',
   'Strong league stage, lost the Grand Final on the last circle of match 8.'),
  ('BGMI Pro Scrims League S4','ProScrims India','Scrim league',
   '2026-10-20','2026-11-30','20 teams, daily scrims, 4 matches a day',
   50000, null, null,'ongoing',
   'Running league. We are chasing a top-4 finish for the playoff slot.')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5. OPPONENTS (scouting)
-- ---------------------------------------------------------------------------
insert into public.opponents (name, tag, roster, playstyle_notes, threat_level, we_eliminated)
values
  ('Titan Reapers','TTR','TTR-BLAZE, TTR-NOVA, TTR-KAI, TTR-RUSH',
   'Very aggressive early. They third-party any fight within 300m of their drop. '
   'They are weak when forced to rotate late into an open zone - punish them there.', 5, 4),
  ('Nova Legion','NVL','NVL-ECHO, NVL-FROST, NVL-ZED, NVL-ARC',
   'Passive edge-of-zone team. They save utility for the last two circles and '
   'almost never contest a drop. Expect them alive in the top 5 with full nades.', 3, 6)
on conflict (name) do nothing;

insert into public.opponent_spots (opponent_id, map_id, spot_name, notes)
select o.id, m.id, v.spot, v.note
from (values
  ('Titan Reapers','Erangel','Pochinki','Always Pochinki if the plane allows it.'),
  ('Titan Reapers','Miramar','Hacienda del Patron','They fight for Hacienda every time.'),
  ('Titan Reapers','Sanhok','Bootcamp','Hot drop Bootcamp, usually north side.'),
  ('Nova Legion','Erangel','Mylta Power','Quiet drop, full loot, late rotate.'),
  ('Nova Legion','Vikendi','Volnova','Edge drop then vehicle rotation.'),
  ('Nova Legion','Rondo','Nan Ling','Loots wide, avoids all early contact.')
) as v(team, map_name, spot, note)
join public.opponents o on o.name = v.team
join public.maps m      on m.name = v.map_name;

-- ---------------------------------------------------------------------------
-- 6. TWENTY MATCHES WITH FULL PER-PLAYER STATS
--    The numbers are shaped by each player's role, so the charts and the
--    leaderboard look like a real team instead of random noise.
-- ---------------------------------------------------------------------------
do $$
declare
  -- Fixed result sheet for 20 matches (so the sample data looks the same for everyone)
  v_placements int[]  := array[1, 3, 2, 7, 1, 5,12, 4, 2, 9, 1, 6, 3,15, 2, 8, 1, 4,11, 3];
  v_mapidx     int[]  := array[1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 3, 2, 5, 4, 1, 3, 2, 5, 4];
  v_contested  bool[] := array[true,false,true,true,false,false,true,false,true,false,
                               false,true,false,true,false,true,false,false,true,false];

  v_map_ids    uuid[];
  v_player_ids uuid[];
  v_tour1      uuid;
  v_tour2      uuid;

  v_match_id   uuid;
  v_map_id     uuid;
  v_spot_id    uuid;
  v_place      int;
  v_type       match_kind;
  v_tour       uuid;
  v_stage      text;
  v_day        int;
  v_mno        int;
  v_name       text;
  v_killer     text;
  v_phase      game_phase;
  v_when       timestamptz;

  -- per-player loop values
  v_pid        uuid;
  v_role       game_role;
  v_fin        int;
  v_knock      int;
  v_assist     int;
  v_dmg        int;
  v_hs         int;
  v_rev        int;
  v_surv       int;
  v_throw      int;
  v_util       int;
  v_veh        int;
  v_long       numeric;
  i            int;
  k            int;
begin
  -- Don't double-seed if this script is run twice
  if (select count(*) from public.matches) > 0 then
    raise notice 'Matches already exist - skipping match seed.';
    return;
  end if;

  perform setseed(0.4242);  -- makes the random numbers below repeatable

  select array_agg(id order by sort_order) into v_map_ids    from public.maps;
  select array_agg(id order by sort_order) into v_player_ids from public.players;
  select id into v_tour1 from public.tournaments where name = 'LastGods Rising Cup 2026';
  select id into v_tour2 from public.tournaments where name = 'BGMI Pro Scrims League S4';

  for i in 1..20 loop
    v_place  := v_placements[i];
    v_map_id := v_map_ids[v_mapidx[i]];

    -- Pick a random drop spot that belongs to this map
    select id into v_spot_id from public.drop_spots
     where map_id = v_map_id order by random() limit 1;

    -- Matches 1-8  = the completed cup
    -- Matches 9-16 = the running scrim league
    -- Matches 17-20 = our own scrims and practice
    if i <= 8 then
      v_type := 'tournament'; v_tour := v_tour1; v_name := null;
      v_day  := case when i <= 4 then 1 else 2 end;
      v_mno  := case when i <= 4 then i else i - 4 end;
      v_stage := case when i <= 4 then 'League' else 'Grand Finals' end;
      v_when := timestamptz '2026-09-12 18:00+05:30' + make_interval(days => v_day - 1, hours => v_mno);
    elsif i <= 16 then
      v_type := 'tournament'; v_tour := v_tour2; v_name := null;
      v_day  := ((i - 9) / 4) + 1;
      v_mno  := ((i - 9) % 4) + 1;
      v_stage := 'League';
      v_when := timestamptz '2026-10-24 19:00+05:30' + make_interval(days => v_day - 1, hours => v_mno);
    else
      v_type := case when i = 20 then 'practice' else 'scrim' end;
      v_tour := null;
      v_name := 'Tier-1 Practice Lobby';
      v_day  := 1; v_mno := i - 16; v_stage := null;
      v_when := timestamptz '2026-10-30 20:00+05:30' + make_interval(hours => v_mno);
    end if;

    -- Who knocked us out, and when
    if v_place = 1 then
      v_killer := null; v_phase := 'survived';
    else
      v_killer := case (i % 3) when 0 then 'Titan Reapers'
                               when 1 then 'Nova Legion'
                               else 'Apex Shadows' end;
      v_phase  := case when v_place >= 10 then 'early'
                       when v_place >= 5  then 'mid'
                       else 'late' end;
    end if;

    insert into public.matches
      (played_at, match_type, tournament_id, scrim_name, stage, day_number, match_number,
       map_id, drop_spot_id, placement, teams_in_lobby, contested, contested_against,
       zone_side, rotation_timing, eliminated_by, eliminated_phase, coach_notes)
    values
      (v_when, v_type, v_tour, v_name, v_stage, v_day, v_mno,
       v_map_id, v_spot_id, v_place, case when v_type = 'tournament' then 16 else 18 end,
       v_contested[i], case when v_contested[i] then 'Titan Reapers' else null end,
       (array['North','South','East','West','Centre'])[1 + (i % 5)],
       (array['Early','On-time','Late'])[1 + (i % 3)],
       v_killer, v_phase,
       case when v_place = 1 then 'Clean execute. Held the compound from circle 4 and closed it out.'
            when v_place <= 3 then 'Good rotation, lost a man too early in the final fight.'
            when v_place <= 8 then 'Rotated late and got caught in the open. Need an earlier call.'
            else 'Drop went wrong. Review the landing split on this spot.' end)
    returning id into v_match_id;

    -- ---- Per-player stats, shaped by role ----
    for k in 1..array_length(v_player_ids, 1) loop
      v_pid := v_player_ids[k];
      select primary_role into v_role from public.players where id = v_pid;

      -- A better placement means a longer match, so more kills and damage
      v_fin := greatest(0, round((case v_role
                 when 'assaulter' then 4.2 when 'sniper' then 3.0
                 when 'igl'       then 2.4 when 'support' then 1.9
                 else 2.8 end) * (1.25 - (v_place::numeric / 22)) + (random() * 2.2 - 0.9))::int);

      v_knock  := v_fin + round(random() * 2)::int;
      v_assist := round(random() * 3)::int
                  + case when v_role in ('support','igl') then 2 else 0 end;
      v_dmg    := greatest(60, (v_fin * 185) + round(random() * 260)::int
                  + case when v_role = 'assaulter' then 150 else 0 end);
      v_hs     := least(v_fin, round(random() * (v_fin::numeric * 0.55))::int);
      v_rev    := case when v_role = 'support' then round(random() * 2 + 0.6)::int
                       else round(random() * 1.2)::int end;
      v_surv   := 540 + ((21 - least(v_place, 20)) * 45) + round(random() * 150)::int;
      v_throw  := case when v_role = 'support' then round(random() * 180)::int
                       else round(random() * 90)::int end;
      v_util   := case when v_role = 'support' then 5 + round(random() * 5)::int
                       else 2 + round(random() * 4)::int end;
      v_veh    := case when random() > 0.88 then 1 else 0 end;
      v_long   := case v_role when 'sniper' then 180 + round(random() * 420)
                              when 'assaulter' then 40 + round(random() * 150)
                              else 50 + round(random() * 200) end;

      insert into public.match_player_stats
        (match_id, player_id, finishes, knocks, assists, damage, headshots, revives,
         survival_seconds, throwable_damage, utility_used, vehicle_kills, longest_kill,
         heals_used, boosts_used)
      values
        (v_match_id, v_pid, v_fin, v_knock, v_assist, v_dmg, v_hs, v_rev,
         v_surv, v_throw, v_util, v_veh, v_long,
         2 + round(random() * 5)::int, 1 + round(random() * 4)::int);
    end loop;

    -- MVP of the match = highest damage
    update public.match_player_stats s
       set is_mvp = true
     where s.match_id = v_match_id
       and s.damage = (select max(damage) from public.match_player_stats
                        where match_id = v_match_id);
  end loop;

  raise notice 'Seeded 20 matches with per-player stats.';
end $$;

-- ---------------------------------------------------------------------------
-- 7. TOURNAMENT STANDINGS (other teams' points, so we can see where we stand)
-- ---------------------------------------------------------------------------
insert into public.tournament_standings
  (tournament_id, team_name, is_us, placement_pts, finish_pts, matches_played, wwcd)
select t.id, v.team, v.us, v.pp, v.fp, 8, v.w
from public.tournaments t
join (values
  ('LastGods Esports', true,  34, 48, 2),
  ('Titan Reapers',    false, 41, 52, 3),
  ('Nova Legion',      false, 38, 44, 2),
  ('Apex Shadows',     false, 27, 39, 1),
  ('Iron Vipers',      false, 22, 31, 0)
) as v(team, us, pp, fp, w) on true
where t.name = 'LastGods Rising Cup 2026'
on conflict (tournament_id, team_name) do nothing;

-- ---------------------------------------------------------------------------
-- 8. SCHEDULE + ATTENDANCE
-- ---------------------------------------------------------------------------
insert into public.schedule_events (title, event_type, starts_at, ends_at, location, notes)
values
  ('Pro Scrims League - Day 5','scrim',  now() + interval '1 day',  now() + interval '1 day 3 hours',  'Custom room', 'Four matches. Be in the room 15 minutes early.'),
  ('Rotation practice - Rondo','practice', now() + interval '2 days', now() + interval '2 days 2 hours', 'Custom room', 'Working on the Nan Ling to Tai Hu rotation.'),
  ('Scrims vs Tier-1 lobby','scrim',     now() + interval '4 days', now() + interval '4 days 3 hours', 'Custom room', 'Titan Reapers are in this lobby. Review their drops first.'),
  ('Team review - VOD session','meeting', now() + interval '6 days', now() + interval '6 days 1 hour', 'Discord', 'Going through match 14 and 15 mistakes.')
on conflict do nothing;

-- Everyone is available for the first event except the substitute
insert into public.attendance (event_id, player_id, status)
select e.id, p.id,
       case when p.status = 'substitute' then 'maybe'::attendance_status
            else 'available'::attendance_status end
from public.schedule_events e
cross join public.players p
where e.title = 'Pro Scrims League - Day 5'
on conflict (event_id, player_id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. STRATEGY NOTES + ANNOUNCEMENTS
-- ---------------------------------------------------------------------------
insert into public.strategy_notes (title, body, map_id, tags, is_pinned)
select v.title, v.body, m.id, v.tags, v.pinned
from (values
  ('Erangel - Pochinki hold',
   E'If we win the Pochinki fight we hold the compound at the south-east corner.\n\n'
   '1. REAPER and HAWK take the two-storey first.\n'
   '2. ATLAS smokes the open side before we cross.\n'
   '3. SHADOW calls the rotation at circle 3, never later.\n\n'
   'Mistake to fix: we keep crossing open ground without a smoke down. '
   'That is how we lost match 4 and match 14.',
   'Erangel', array['rotation','hold'], true),
  ('Miramar - late zone discipline',
   E'Miramar punishes late rotations harder than any other map.\n\n'
   'Target: be inside circle 3 before the timer hits 30 seconds.\n'
   'Vehicle rule: never leave the car in the open, park it behind a compound.\n'
   'We have the vehicle - use it early, not as a panic rotate.',
   'Miramar', array['rotation','zone'], false),
  ('Rondo - Nan Ling opening',
   E'Nan Ling gives us a quiet drop with enough loot for all four.\n\n'
   'Split: SHADOW + ATLAS north houses, REAPER + HAWK south.\n'
   'Rotate by 4 minutes toward Tai Hu, take the high ground before the first circle.',
   'Rondo', array['drop','opening'], false)
) as v(title, body, map_name, tags, pinned)
left join public.maps m on m.name = v.map_name;

insert into public.announcements (title, body, is_pinned) values
  ('Scrim timings changed to 7 PM',
   'Starting this week all scrims move to 7:00 PM IST. Be in the custom room by 6:45. '
   'If you cannot make it, mark yourself on the Schedule page before 5 PM.', true),
  ('Review before Pro Scrims Day 5',
   'Watch your own deaths from match 13 and 14 before the next session. '
   'We are losing too many players in the early rotation.', false)
on conflict do nothing;

-- Done. Your database is ready. Next: set up the .env file in the project.
