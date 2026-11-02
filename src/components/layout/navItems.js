/**
 * The navigation map for the whole app.
 * `adminOnly` hides an item from everyone except Owner/Admin.
 * `mobile: true` puts the item in the phone's bottom bar.
 */
import {
  LayoutDashboard,
  Users,
  Swords,
  Map as MapIcon,
  Crosshair,
  Trophy,
  GitCompareArrows,
  Shield,
  CalendarDays,
  NotebookPen,
  Medal,
  Settings as SettingsIcon,
  ListOrdered,
} from 'lucide-react'

export const NAV_GROUPS = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, mobile: true },
      { to: '/roster', label: 'Roster', icon: Users, mobile: true },
      { to: '/matches', label: 'Matches', icon: Swords, mobile: true },
    ],
  },
  {
    title: 'Analysis',
    items: [
      { to: '/maps', label: 'Maps', icon: MapIcon },
      { to: '/drop-spots', label: 'Drop Spots', icon: Crosshair },
      { to: '/leaderboard', label: 'Leaderboard', icon: ListOrdered, mobile: true },
      { to: '/compare', label: 'Compare', icon: GitCompareArrows },
    ],
  },
  {
    title: 'Competition',
    items: [
      { to: '/tournaments', label: 'Tournaments', icon: Trophy },
      { to: '/opponents', label: 'Opponents', icon: Shield },
      { to: '/schedule', label: 'Schedule', icon: CalendarDays },
    ],
  },
  {
    title: 'Team',
    items: [
      { to: '/notes', label: 'Notes & Board', icon: NotebookPen },
      { to: '/records', label: 'Records', icon: Medal },
      { to: '/settings', label: 'Settings', icon: SettingsIcon, adminOnly: true },
    ],
  },
]

/** Flat list, used by the mobile bottom bar. */
export const MOBILE_NAV = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.mobile)

/** Filters the sidebar for the person who is logged in. */
export function visibleGroups(isAdmin) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((group) => group.items.length > 0)
}
