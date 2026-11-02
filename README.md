# LastGods Esports — Team Analytics Platform

A private BGMI stats and team-management site for one team. Players, coach,
analyst and management log in; nobody else can see anything.

Built with **React + Vite + Tailwind CSS**, **Supabase** (database, login, file
storage, realtime) and **Recharts**. Hosted free on **Vercel**.

---

## Table of contents

1. [What you need before you start](#1-what-you-need-before-you-start)
2. [Set up the database (Supabase)](#2-set-up-the-database-supabase)
3. [Run the site on your laptop](#3-run-the-site-on-your-laptop)
4. [First steps inside the app](#4-first-steps-inside-the-app)
   — including [carrying over old stats](#45-carry-over-stats-from-before-you-started-logging)
5. [Add your teammates](#5-add-your-teammates)
6. [Put it online (Vercel)](#6-put-it-online-vercel)
7. [Day-to-day use](#7-day-to-day-use)
8. [How the numbers are calculated](#8-how-the-numbers-are-calculated)
9. [Project structure](#9-project-structure)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. What you need before you start

Three free accounts and one program. Nothing costs money.

| What | Where | Why |
|---|---|---|
| **Node.js** (v20 or newer) | [nodejs.org](https://nodejs.org) — download the **LTS** version | Runs the site on your laptop |
| **Supabase account** | [supabase.com](https://supabase.com) | Your database and logins |
| **GitHub account** | [github.com](https://github.com) | Stores your code, feeds Vercel |
| **Vercel account** | [vercel.com](https://vercel.com) | Puts the site on the internet |

Check Node.js installed correctly — open a terminal in VS Code
(**Terminal → New Terminal**) and run:

```bash
node -v
npm -v
```

You should see version numbers. If you see "not recognized", close VS Code
completely and reopen it.

---

## 2. Set up the database (Supabase)

### 2.1 Create the project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Fill in:
   - **Name:** `lastgods-esports`
   - **Database Password:** click Generate, then **save it somewhere safe**
   - **Region:** pick the one closest to you (for India: `South Asia (Mumbai)`)
4. Click **Create new project** and wait about two minutes.

### 2.2 Run the four SQL files

This creates every table, every security rule, and some sample data to test with.

1. In Supabase, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/01_schema.sql` from this project in VS Code.
   Select everything (`Ctrl+A`), copy (`Ctrl+C`), paste into Supabase, click **Run**.
   You should see *Success. No rows returned.*
4. Click **New query** again and repeat with `supabase/02_rls.sql`.
5. Click **New query** again and repeat with `supabase/03_seed.sql`.
6. Click **New query** again and repeat with `supabase/04_manual_totals.sql`.

> **Run them in order — 01, then 02, then 03, then 04.** Each one depends on
> the last.

`04_manual_totals.sql` adds the table that stores *carried-over* stats — the
kills, damage and wins your players earned before you started logging matches
here. It only adds a new table, so it is safe to run on a database that is
already full of real matches, and safe to run twice. See §4.5.

**If step 3 shows an error about `storage.objects`:** the tables were still
created. Skip to §2.5 to create the three storage buckets by hand instead.

### 2.3 Create your own login

No one can sign up from the website — that's deliberate. Accounts are created here.

1. In Supabase click **Authentication** → **Users** → **Add user** →
   **Create new user**.
2. Enter **your** email and a password you will remember.
3. **Tick "Auto Confirm User"** — without this you cannot sign in.
4. Click **Create user**.

> The **first account you create automatically becomes the Owner**, with full
> control over everything. Create your own account first.

### 2.4 Copy your two keys

1. Click the **gear icon (Project Settings)** → **API Keys** (older projects:
   **API**).
2. Keep this tab open. You need two values in the next step:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a very long string starting `eyJ...`

> ⚠️ There is also a **service_role** key on that page. **Never** copy that one
> into this project. It bypasses all security. The anon key is safe in the
> browser because the Row Level Security rules in `02_rls.sql` control what it
> can actually see.

### 2.5 Check the storage buckets

Click **Storage** in the sidebar. You should see three buckets: `avatars`,
`screenshots` and `branding`.

If they aren't there, create each one with **New bucket**, give it the exact
name, and **turn on "Public bucket"**.

---

## 3. Run the site on your laptop

### 3.1 Create your `.env` file

The project folder already has a file called `.env.example`. You need to make a
copy of it named `.env`.

**In VS Code:** right-click `.env.example` in the file list → **Copy**, then
right-click empty space → **Paste**, and rename the copy to exactly `.env`
(no `.example`).

Open `.env` and paste in your two values from §2.4:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

No quotes, no spaces around the `=`.

> `.env` is already listed in `.gitignore`, so your keys will never be uploaded
> to GitHub.

### 3.2 Install and start

In the VS Code terminal, in the project folder:

```bash
npm install
npm run dev
```

Your browser opens at **http://localhost:5173**. Sign in with the email and
password from §2.3.

To stop the server, press `Ctrl+C` in the terminal.

### 3.3 Did it work?

You should see the dashboard with sample data: 20 matches, 5 players, charts and
a leaderboard. Click through Roster → a player → scroll to the **map-wise
breakdown**. That's the sample data working.

---

## 4. First steps inside the app

Work through these in order the first time.

### 4.1 Make it yours — Settings → Team

Change the team name and tagline, upload your logo, pick your accent colour.
Everything updates instantly.

### 4.2 Clear the sample data

Once you've had a look around, delete the sample matches. In Supabase →
**SQL Editor** → **New query**:

```sql
-- Removes the 20 sample matches and all their player stats.
-- Keeps your maps, drop spots, players and settings.
delete from public.matches;
```

To remove the sample players, opponents and schedule too:

```sql
delete from public.matches;
delete from public.players;
delete from public.opponents;
delete from public.schedule_events;
delete from public.strategy_notes;
delete from public.announcements;
delete from public.tournaments;
delete from public.activity_log;
```

Keep the maps and drop spots — they're the real BGMI ones and you'll want them.

### 4.3 Add your real roster

**Roster → Add player.** Fill in the IGN, real name, roles, device and
sensitivity. Add everyone, including substitutes.

### 4.4 Add your first real match

**Matches → Add match**, or the **Add Match** button in the top bar.

- Fill in the date, type, map and drop spot
- Enter the placement — **points calculate themselves** as you type
- Tick everyone who played, then type their numbers from the result screen
- **Quick entry** (the default) shows only the five columns you always have:
  finishes, knocks, assists, damage, MVP. Click **Show all columns** for
  survival time, utility, longest kill and the rest.
- Save.

Everything else in the site — dashboard totals, map breakdowns, drop-spot
analysis, leaderboard, records — updates from that one save.

### 4.5 Carry over stats from before you started logging

Your team did not begin the day you installed this. **Roster → edit a player**
opens a modal with three tabs:

| Tab | What it holds |
|---|---|
| **Profile** | IGN, real name, primary + secondary role, status, device, FPS, gyro, sensitivity, weapons, join date, character ID, photo |
| **Overall Stats** | Carried-over matches, kills, knocks, assists, damage, headshots, revives, wins, top 10s, MVPs, avg survival, throwable damage, vehicle kills, longest kill |
| **Map Stats** | The same idea per map — matches, kills, knocks, damage, headshots, wins, MVPs |

Type what the player already had. Every field shows the sum live as you type:

```
20 manual  +  35 logged  =  55
```

Those numbers are never recalculated or overwritten by the app. Logged matches
are simply added on top, and the result flows into the Roster cards, the player
profile, the map-wise breakdown, the leaderboard, Compare, the milestones on
Records, and the Player Rating.

**Three things worth knowing:**

- **Only Owner, Admin, Coach and Analyst see the stat tabs.** A Player editing
  their own card gets the Profile tab only. That is enforced by the database,
  not just hidden in the interface — see the policies in `04_manual_totals.sql`.
- **Carry-over stats only appear on all-time views.** Filter the leaderboard to
  "last 7 days" or to one tournament and they drop out, because stats from last
  season are not part of this week. Filtering by **map** keeps them, and swaps
  in that player's carried-over row for that map.
- **Average placement and kill-contribution % stay on logged matches only.** A
  carried-over total has no placements to average, so including it would drag
  those two numbers towards zero.

**Team-wide carry-over** — the whole squad's past totals on the Dashboard — is a
separate setting: **Settings → Totals**, where you can switch off
auto-calculation and type the team's own numbers.

---

## 5. Add your teammates

Repeat §2.3 for each person, then set their permission level in the app.

1. **Supabase → Authentication → Users → Add user.** Their email, a temporary
   password, **Auto Confirm User ticked**.
2. In your site, go to **Settings → Users**. They appear in the list.
3. Set their **permission level** from the dropdown.
4. If they're a player, also pick their name in the **player** dropdown. That
   link lets them edit their own profile and mark their own availability.
5. Send them the site link. They sign in with their email and the temporary
   password, or use **Forgot your password?** to set their own.

### The five permission levels

| Level | Can do |
|---|---|
| **Owner / Admin** | Everything, including Settings, users, maps and the points table |
| **Coach / Analyst** | Add and edit matches, player stats, tournaments, scouting, notes, schedule |
| **Player** | View everything; edit **their own** profile; mark **their own** availability |
| **Viewer** | Read only |

These rules are enforced by the database itself (`supabase/02_rls.sql`), not
just by hiding buttons. A Player cannot delete a match even using the API
directly.

---

## 6. Put it online (Vercel)

So the squad can open it from a phone.

### 6.1 Push the code to GitHub

The project folder is already set up as its own Git repository, and the files
are already staged. In the VS Code terminal, make the first commit:

```bash
git add .
git commit -m "LastGods Esports platform"
```

Then create the repository on GitHub:

1. Go to [github.com/new](https://github.com/new)
2. **Repository name:** `lastgods-esports`
3. Choose **Private**
4. **Do not** tick "Add a README" — the project already has one
5. Click **Create repository**

GitHub then shows you two commands. Run them in your terminal — they look like:

```bash
git remote add origin https://github.com/YOUR-USERNAME/lastgods-esports.git
git branch -M main
git push -u origin main
```

> Check on GitHub that there is **no `.env` file** in the uploaded files. There
> shouldn't be — `.gitignore` excludes it.

### 6.2 Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in **with GitHub**.
2. Click **Add New → Project**.
3. Find `lastgods-esports` and click **Import**.
4. Vercel detects Vite automatically. Leave the build settings alone.
5. Expand **Environment Variables** and add both:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon public key |

   (Same two values as your `.env` file.)
6. Click **Deploy** and wait a minute.

You get a link like `https://lastgods-esports.vercel.app`.

### 6.3 Tell Supabase about the new address

Password reset emails need to know where to send people.

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL:** `https://lastgods-esports.vercel.app`
3. **Redirect URLs:** add both of these:
   - `https://lastgods-esports.vercel.app/**`
   - `http://localhost:5173/**`
4. Save.

### 6.4 Share it

Send the Vercel link to the team. On a phone, **Add to Home Screen** makes it
open like an app.

### 6.5 Updating the site later

Any time you change the code:

```bash
git add .
git commit -m "what you changed"
git push
```

Vercel rebuilds and redeploys automatically in about a minute.

---

## 7. Day-to-day use

| Page | What it's for |
|---|---|
| **Dashboard** | Team totals, form, trends, top performers, what's coming up |
| **Roster** | Every player with their rating and recent form |
| **Player profile** | Full stats, **map-wise breakdown**, records, match history |
| **Matches** | The match log, with filters and search |
| **Maps** | Which maps you win on, and which you don't |
| **Drop Spots** | Which landings actually pay off — contested rate, survival rate, avg points |
| **Leaderboard** | Rank the squad by any stat, filtered any way |
| **Compare** | Two players side by side, radar overlay, optionally on one map |
| **Tournaments** | Points per day, stage progression, standings against other teams |
| **Opponents** | Scouting notes, their usual drops, head-to-head record |
| **Schedule** | Sessions and availability; attendance record |
| **Notes & Board** | Strategy notes per map, announcements for the team |
| **Records** | Hall of fame and player milestones |
| **Settings** | Branding, users, maps, points table, rating weights, export/import, activity log |

**Realtime:** when the coach saves a match on a laptop, everyone else's screen
updates by itself. No refresh needed.

**Activity log:** every add, edit and delete is recorded with who did it and
when. See it on the dashboard, or in full under Settings → Activity log.

---

## 8. How the numbers are calculated

### Points (BGMI esports format)

| Placement | Points | | Placement | Points |
|---|---|---|---|---|
| 1st (WWCD) | 10 | | 6th | 2 |
| 2nd | 6 | | 7th | 1 |
| 3rd | 5 | | 8th | 1 |
| 4th | 4 | | 9th and below | 0 |
| 5th | 3 | | **Each finish** | **+1** |

**Total = placement points + finishes.** The database works this out itself —
you never type a points value.

Different tournament? Change the table in **Settings → Scoring**, or give one
tournament its own format.

### Player Rating (0–100)

Five parts of a player's game are each scored against an elite benchmark, then
mixed using the weights in **Settings → Scoring**:

| Part | 100% benchmark | Default weight |
|---|---|---|
| Finishes | 5 per match | 30 |
| Damage | 800 per match | 25 |
| Assists | 3 per match | 10 |
| Survival | 18 minutes per match | 20 |
| Revives | 1.5 per match | 15 |

The weights should add up to 100.

### Everything is recalculated, never stored twice

Every total, average, map breakdown and leaderboard is worked out from the raw
per-player match rows each time you open a page. That's why editing or deleting
a match fixes every number everywhere — there is no second copy to go stale.

---

## 9. Project structure

```
lastgods-esports-pro/
├── .env                     ← your keys (never committed)
├── .env.example             ← template to copy
├── supabase/
│   ├── 01_schema.sql        ← tables, triggers, auto-calculation
│   ├── 02_rls.sql           ← who can do what (security)
│   ├── 03_seed.sql          ← sample data for testing
│   └── 04_manual_totals.sql ← carried-over stats from before logging
└── src/
    ├── main.jsx             ← starts the app
    ├── App.jsx              ← every route/page address
    ├── index.css            ← the dark theme, fonts, colours
    ├── lib/
    │   ├── supabase.js      ← the database connection
    │   ├── api.js           ← every read and write
    │   ├── stats.js         ← THE STATS ENGINE — all calculations
    │   ├── constants.js     ← roles, statuses, points table, colours
    │   ├── format.js        ← number and date formatting
    │   └── csv.js           ← export / import
    ├── context/
    │   ├── AuthContext.jsx  ← who is logged in, what they may do
    │   └── DataContext.jsx  ← the shared data + realtime updates
    ├── components/
    │   ├── ui/              ← buttons, cards, tables, charts, modals
    │   ├── layout/          ← sidebar, top bar, bottom nav, guards
    │   ├── players/         ← the player form
    │   └── matches/         ← the match form
    └── pages/               ← one file per page
```

**If you want to change a calculation, `src/lib/stats.js` is the only file you
need.** Every page reads from it.

---

## 10. Troubleshooting

**"Almost there" setup screen instead of the login**
`.env` is missing, named wrong, or the server wasn't restarted. The file must be
called exactly `.env` and sit next to `package.json`. Stop the server
(`Ctrl+C`) and run `npm run dev` again — Vite only reads `.env` at startup.

**"Wrong email or password"**
Either the password is wrong, or the user wasn't confirmed. In Supabase →
Authentication → Users, check the user has a confirmed date. If not, delete them
and create again with **Auto Confirm User** ticked.

**"Account not set up" after signing in**
The login exists but has no profile row. That happens if the account was created
*before* you ran `01_schema.sql`. Delete the user in Supabase and create them
again.

**"Could not load data"**
Usually the SQL files haven't been run, or only some of them. Re-run `01`, `02`
and `03` in order — they're safe to run more than once.

**"You don't have permission to do that"**
Working as intended — your permission level doesn't allow it. An Admin can
change it in Settings → Users.

**Nothing shows on the dashboard**
No matches logged yet (or you just cleared the samples). Add a match.

**Photos won't upload**
Check Supabase → Storage has the three buckets from §2.5, and that each one is
marked **Public**.

**Changes don't appear on the live site**
Did you `git push`? Check the Deployments tab on Vercel for a failed build.

**Vercel build fails**
Open the build log on Vercel. The usual cause is a missing environment variable
— check both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in
**Project Settings → Environment Variables**, then **Redeploy**.

**Page reloads give a 404 on Vercel**
`vercel.json` handles this. Make sure that file was committed and pushed.

---

## Commands reference

```bash
npm install      # install dependencies (first time, or after pulling changes)
npm run dev      # run locally at http://localhost:5173
npm run build    # make the production build (Vercel does this for you)
npm run preview  # preview the production build locally
```
