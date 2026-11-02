/**
 * The frame around every logged-in page:
 *   desktop -> collapsible sidebar on the left + top bar
 *   phone   -> top bar + fixed bottom navigation
 */
import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import {
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Menu,
  X,
  Plus,
  MoreHorizontal,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { MOBILE_NAV, visibleGroups } from './navItems'
import { TeamLogo } from '@/components/ui/Avatar'
import { AppRoleBadge } from '@/components/ui/Chips'
import { Button } from '@/components/ui/Primitives'
import { cx } from '@/lib/format'

/* ---------------------------------------------------------------------------
 * SIDEBAR (desktop)
 * ------------------------------------------------------------------------- */
function Sidebar({ collapsed, onToggle }) {
  const { isAdmin } = useAuth()
  const { settings } = useData()
  const groups = visibleGroups(isAdmin)

  return (
    <aside
      className={cx(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface',
        'transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[72px]' : 'w-60',
      )}
    >
      {/* Team identity */}
      <Link
        to="/"
        className={cx(
          'flex items-center gap-3 border-b border-line p-4 transition-colors hover:bg-card-hi',
          collapsed && 'justify-center px-2',
        )}
      >
        <TeamLogo src={settings.logo_url} name={settings.team_name} size="sm" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-none font-semibold uppercase tracking-wide text-fg">
              {settings.team_name}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-faint">{settings.tagline}</p>
          </div>
        )}
      </Link>

      {/* Links */}
      <nav className="flex-1 space-y-4 overflow-y-auto p-2.5">
        {groups.map((group) => (
          <div key={group.title}>
            {!collapsed && <p className="label mb-1.5 px-2.5">{group.title}</p>}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus-accent',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-accent/15 text-accent'
                        : 'text-muted hover:bg-card-hi hover:text-fg',
                    )
                  }
                >
                  <item.icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <button
        onClick={onToggle}
        className="flex items-center gap-3 border-t border-line p-3.5 text-sm text-muted transition-colors hover:bg-card-hi hover:text-fg focus-accent"
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  )
}

/* ---------------------------------------------------------------------------
 * MOBILE DRAWER — the full menu behind the hamburger button
 * ------------------------------------------------------------------------- */
function MobileDrawer({ open, onClose }) {
  const { isAdmin } = useAuth()
  const { settings } = useData()
  const groups = visibleGroups(isAdmin)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-72 max-w-[85vw] flex-col border-l border-line bg-surface animate-[fade-in_0.2s_ease-out]">
        <div className="flex items-center justify-between border-b border-line p-4">
          <div className="flex items-center gap-3">
            <TeamLogo src={settings.logo_url} name={settings.team_name} size="sm" />
            <p className="font-display text-lg font-semibold uppercase text-fg">
              {settings.team_name}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-fg">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="label mb-1.5 px-2">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                        isActive
                          ? 'bg-accent/15 text-accent'
                          : 'text-muted hover:bg-card-hi hover:text-fg',
                      )
                    }
                  >
                    <item.icon size={18} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * TOP BAR
 * ------------------------------------------------------------------------- */
function Topbar({ onOpenMenu }) {
  const { profile, role, signOut, can } = useAuth()
  const { settings } = useData()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-3 backdrop-blur-md sm:px-5">
      {/* Phone: team name on the left */}
      <Link to="/" className="flex items-center gap-2 lg:hidden">
        <TeamLogo src={settings.logo_url} name={settings.team_name} size="xs" />
        <span className="font-display text-xl leading-none font-semibold uppercase text-fg">
          {settings.team_name}
        </span>
      </Link>

      <div className="flex-1" />

      {can.editMatches && (
        <Link to="/matches?new=1">
          <Button size="sm" className="hidden sm:inline-flex">
            <Plus size={15} /> Add Match
          </Button>
        </Link>
      )}

      {/* Who is logged in */}
      <div className="hidden items-center gap-2.5 sm:flex">
        <div className="text-right">
          <p className="max-w-[160px] truncate text-xs font-medium text-fg">
            {profile?.full_name || profile?.email}
          </p>
          <AppRoleBadge role={role} size="sm" />
        </div>
      </div>

      <button
        onClick={signOut}
        title="Sign out"
        className="rounded-lg p-2 text-muted transition-colors hover:bg-card-hi hover:text-bad focus-accent"
      >
        <LogOut size={18} />
      </button>

      <button
        onClick={onOpenMenu}
        className="rounded-lg p-2 text-muted transition-colors hover:bg-card-hi hover:text-fg focus-accent lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
    </header>
  )
}

/* ---------------------------------------------------------------------------
 * BOTTOM NAVIGATION (phone)
 * ------------------------------------------------------------------------- */
function BottomNav({ onOpenMenu }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {MOBILE_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cx(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-accent' : 'text-muted',
            )
          }
        >
          <item.icon size={19} />
          {item.label}
        </NavLink>
      ))}
      <button
        onClick={onOpenMenu}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted"
      >
        <MoreHorizontal size={19} />
        More
      </button>
    </nav>
  )
}

/* ---------------------------------------------------------------------------
 * LAYOUT
 * ------------------------------------------------------------------------- */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('lg-sidebar') === 'collapsed',
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    localStorage.setItem('lg-sidebar', collapsed ? 'collapsed' : 'open')
  }, [collapsed])

  // Close the drawer and scroll to the top whenever the route changes
  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />

        <main className="flex-1 px-3 pb-24 pt-4 sm:px-5 sm:pb-8 sm:pt-5">
          <div className="mx-auto w-full max-w-[1500px]">
            <Outlet />
          </div>
        </main>

        <BottomNav onOpenMenu={() => setMenuOpen(true)} />
      </div>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
