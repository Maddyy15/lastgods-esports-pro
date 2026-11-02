/**
 * Shown instead of the app when the .env file has not been filled in yet.
 * It is a friendly reminder rather than a crash, so a blank screen never
 * leaves you guessing.
 */
import { Terminal } from 'lucide-react'

const STEPS = [
  {
    title: 'Create a Supabase project',
    body: 'Go to supabase.com, sign in with GitHub or email, and click New Project. The free tier is enough. Choose a region close to you.',
  },
  {
    title: 'Run the SQL',
    body: 'In Supabase open SQL Editor → New query. Paste supabase/01_schema.sql and Run. Repeat for 02_rls.sql, then 03_seed.sql.',
  },
  {
    title: 'Copy your keys',
    body: 'In Supabase go to Project Settings → API. Copy the Project URL and the anon public key. Never copy the service_role key into this project.',
  },
  {
    title: 'Create the .env file',
    body: 'In the project folder, copy .env.example to a new file called .env and paste the two values in. Then stop the dev server and run npm run dev again.',
  },
]

export default function SetupNeeded() {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-5 py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-accent/10 p-3 text-accent">
          <Terminal size={24} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-fg">
            Almost there
          </h1>
          <p className="text-sm text-muted">
            LastGods cannot reach Supabase yet. Four short steps and you are in.
          </p>
        </div>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="card-base flex gap-4 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-head text-sm font-bold text-accent">
              {i + 1}
            </span>
            <div>
              <p className="font-head font-semibold text-fg">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-xl border border-line bg-surface p-4">
        <p className="label mb-2">Your .env should look like this</p>
        <pre className="overflow-x-auto rounded-lg bg-ink p-3 text-xs leading-relaxed text-muted">
{`VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...`}
        </pre>
        <p className="mt-2 text-[11px] text-faint">
          The .env file is already listed in .gitignore, so it will never be pushed
          to GitHub.
        </p>
      </div>
    </div>
  )
}
