/**
 * App — providers, the toast system, and every route in the site.
 */
import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { AuthProvider, useAuth } from '@/context/AuthContext'
import { DataProvider, useData } from '@/context/DataContext'
import { isSupabaseConfigured } from '@/lib/supabase'

import AppLayout from '@/components/layout/AppLayout'
import {
  RequireAuth,
  RequireAdmin,
  LoadingScreen,
  DataErrorScreen,
} from '@/components/layout/Guards'

import Login from '@/pages/Login'
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Roster = lazy(() => import('@/pages/Roster'))
const PlayerProfile = lazy(() => import('@/pages/PlayerProfile'))
const Matches = lazy(() => import('@/pages/Matches'))
const MatchDetail = lazy(() => import('@/pages/MatchDetail'))
const Maps = lazy(() => import('@/pages/Maps'))
const MapDetail = lazy(() => import('@/pages/MapDetail'))
const DropSpots = lazy(() => import('@/pages/DropSpots'))
const Leaderboard = lazy(() => import('@/pages/Leaderboard'))
const Compare = lazy(() => import('@/pages/Compare'))
const Tournaments = lazy(() => import('@/pages/Tournaments'))
const TournamentDetail = lazy(() => import('@/pages/TournamentDetail'))
const Opponents = lazy(() => import('@/pages/Opponents'))
const Schedule = lazy(() => import('@/pages/Schedule'))
const Notes = lazy(() => import('@/pages/Notes'))
const Records = lazy(() => import('@/pages/Records'))
const Settings = lazy(() => import('@/pages/Settings'))
import SetupNeeded from '@/pages/SetupNeeded'
import NotFound from '@/pages/NotFound'

/** Holds the app back until the team data has arrived. */
function DataGate({ children }) {
  const { loading, error, matches } = useData()
  const { profile } = useAuth()

  if (error) return <DataErrorScreen />
  // Only block on the very first load, when we have nothing to show yet
  if (loading && !matches.length && !profile) return <LoadingScreen />
  return children
}

/**
 * Pages are code-split: the browser only downloads a page the first time
 * someone opens it. That keeps the first load small, which matters because
 * most of the squad opens this on a phone.
 */
function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading page…" />}>
      <Routes>
      {/* ---- public ---- */}
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ---- everything else needs a login ---- */}
      <Route
        element={
          <RequireAuth>
            <DataGate>
              <AppLayout />
            </DataGate>
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="roster" element={<Roster />} />
        <Route path="players/:playerId" element={<PlayerProfile />} />
        <Route path="matches" element={<Matches />} />
        <Route path="matches/:matchId" element={<MatchDetail />} />
        <Route path="maps" element={<Maps />} />
        <Route path="maps/:mapId" element={<MapDetail />} />
        <Route path="drop-spots" element={<DropSpots />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="compare" element={<Compare />} />
        <Route path="tournaments" element={<Tournaments />} />
        <Route path="tournaments/:tournamentId" element={<TournamentDetail />} />
        <Route path="opponents" element={<Opponents />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="notes" element={<Notes />} />
        <Route path="records" element={<Records />} />
        <Route
          path="settings"
          element={
            <RequireAdmin>
              <Settings />
            </RequireAdmin>
          }
        />
        <Route path="404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  // Before anything else: has the .env file been filled in?
  if (!isSupabaseConfigured) return <SetupNeeded />

  return (
    <AuthProvider>
      <DataProvider>
        <AppRoutes />

        {/* Toast notifications, styled to match the dark theme */}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3200,
            style: {
              background: '#13161c',
              color: '#eef1f6',
              border: '1px solid #232834',
              borderRadius: '12px',
              fontSize: '14px',
              maxWidth: '92vw',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#13161c' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#13161c' } },
          }}
        />
      </DataProvider>
    </AuthProvider>
  )
}
