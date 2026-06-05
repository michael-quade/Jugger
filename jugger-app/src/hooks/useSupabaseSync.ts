import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase, isSupabaseEnabled } from '../lib/supabase'
import { useTournamentStore } from '../store/useTournamentStore'
import type { TournamentState, Match, TeamRoundScore } from '../types'

export const useSyncStatus = create<{ connected: boolean }>(() => ({ connected: false }))

// Keys synced via the app_state table (everything except matches and teamScores)
const APP_STATE_KEYS: (keyof TournamentState)[] = [
  'year', 'teams', 'courses', 'roundConfigs', 'holeInOnes',
  'ctpEntries', 'ctpDonations', 'ctpHioHistory', 'hdcpLocked',
  'courseHistory', 'admins', 'pairingsLocked', 'hioDonations',
]

// Counter instead of boolean so nested remote-apply calls compose correctly.
// remoteDepth > 0 means "this setState came from Supabase — don't push it back."
let remoteDepth = 0

export function useSupabaseSync() {
  useEffect(() => {
    if (!supabase || !isSupabaseEnabled) return

    const db = supabase
    const YEAR = useTournamentStore.getState().year
    const APP_STATE_ID = `jugger-${YEAR}`
    let prevState = useTournamentStore.getState()
    let appStateTimer: ReturnType<typeof setTimeout> | null = null

    // ── Helpers: apply a remote row to the local store ─────────────────────

    function applyAppState(state: Partial<TournamentState>) {
      remoteDepth++
      const updates: Partial<TournamentState> = {}
      for (const key of APP_STATE_KEYS) {
        if ((state as any)[key] !== undefined) (updates as any)[key] = (state as any)[key]
      }
      useTournamentStore.setState(updates)
      prevState = useTournamentStore.getState()
      remoteDepth--
    }

    function applyMatch(match: Match) {
      remoteDepth++
      useTournamentStore.setState(state => ({
        matches: state.matches.some(m => m.id === match.id)
          ? state.matches.map(m => m.id === match.id ? match : m)
          : [...state.matches, match],
      }))
      prevState = useTournamentStore.getState()
      remoteDepth--
    }

    function applyMatchDelete(matchId: string) {
      remoteDepth++
      useTournamentStore.setState(state => ({ matches: state.matches.filter(m => m.id !== matchId) }))
      prevState = useTournamentStore.getState()
      remoteDepth--
    }

    function applyTeamScore(row: { team_id: string; round: number; points: number; notes?: string | null }) {
      const incoming: TeamRoundScore = {
        teamId: row.team_id, round: row.round, points: row.points, notes: row.notes ?? undefined,
      }
      remoteDepth++
      useTournamentStore.setState(state => {
        const idx = state.teamScores.findIndex(s => s.teamId === incoming.teamId && s.round === incoming.round)
        if (idx >= 0) {
          const updated = [...state.teamScores]
          updated[idx] = incoming
          return { teamScores: updated }
        }
        return { teamScores: [...state.teamScores, incoming] }
      })
      prevState = useTournamentStore.getState()
      remoteDepth--
    }

    function applyTeamScoreDelete(teamId: string, round: number) {
      remoteDepth++
      useTournamentStore.setState(state => ({
        teamScores: state.teamScores.filter(s => !(s.teamId === teamId && s.round === round)),
      }))
      prevState = useTournamentStore.getState()
      remoteDepth--
    }

    // ── Real-time subscriptions ─────────────────────────────────────────────

    const channel = db.channel('jugger-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state',
          filter: `id=eq.${APP_STATE_ID}` }, payload => {
        const row = payload.new as any
        if (row?.state) applyAppState(row.state)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches',
          filter: `tournament_year=eq.${YEAR}` }, payload => {
        const row = payload.new as any
        if (row?.match_json) applyMatch(row.match_json)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches',
          filter: `tournament_year=eq.${YEAR}` }, payload => {
        const row = payload.new as any
        if (row?.match_json) applyMatch(row.match_json)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'matches' }, payload => {
        const row = payload.old as any
        if (row?.match_id && row?.tournament_year === YEAR) applyMatchDelete(row.match_id)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_scores',
          filter: `tournament_year=eq.${YEAR}` }, payload => {
        const row = payload.new as any
        if (row) applyTeamScore(row)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'team_scores',
          filter: `tournament_year=eq.${YEAR}` }, payload => {
        const row = payload.new as any
        if (row) applyTeamScore(row)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'team_scores' }, payload => {
        const row = payload.old as any
        if (row?.tournament_year === YEAR) applyTeamScoreDelete(row.team_id, row.round)
      })
      .subscribe(status => {
        useSyncStatus.setState({ connected: status === 'SUBSCRIBED' })
      })

    // ── Local → Supabase: push store changes ────────────────────────────────

    const unsubscribe = useTournamentStore.subscribe(newState => {
      // Skip: this setState came from Supabase, not from local user action
      if (remoteDepth > 0) { prevState = newState; return }

      // Upsert changed or new matches
      if (newState.matches !== prevState.matches) {
        const changedOrNew = newState.matches.filter(m => {
          const old = prevState.matches.find(pm => pm.id === m.id)
          return old !== m
        })
        for (const match of changedOrNew) {
          db.from('matches').upsert(
            { match_id: match.id, tournament_year: YEAR, match_json: match },
            { onConflict: 'match_id' },
          ).then(({ error }) => { if (error) console.error('[supabase] match upsert:', error.message) })
        }

        // Delete removed matches (e.g. pairings reset)
        const removed = prevState.matches.filter(pm => !newState.matches.find(nm => nm.id === pm.id))
        if (removed.length > 0) {
          db.from('matches').delete().in('match_id', removed.map(m => m.id))
            .then(({ error }) => { if (error) console.error('[supabase] match delete:', error.message) })
        }
      }

      // Upsert changed team scores
      if (newState.teamScores !== prevState.teamScores) {
        const changed = newState.teamScores.filter(s => {
          const old = prevState.teamScores.find(ps => ps.teamId === s.teamId && ps.round === s.round)
          return old !== s
        })
        for (const score of changed) {
          db.from('team_scores').upsert(
            { tournament_year: YEAR, team_id: score.teamId, round: score.round,
              points: score.points, notes: score.notes ?? null },
            { onConflict: 'tournament_year,team_id,round' },
          ).then(({ error }) => { if (error) console.error('[supabase] team_score upsert:', error.message) })
        }

        // Delete removed team scores (e.g. clearAllTeamScores)
        const removedScores = prevState.teamScores.filter(
          ps => !newState.teamScores.find(ns => ns.teamId === ps.teamId && ns.round === ps.round)
        )
        for (const score of removedScores) {
          db.from('team_scores').delete()
            .eq('tournament_year', YEAR).eq('team_id', score.teamId).eq('round', score.round)
            .then(({ error }) => { if (error) console.error('[supabase] team_score delete:', error.message) })
        }
      }

      // Debounce app state (teams, configs, etc.) — changes are infrequent
      const appStateChanged = APP_STATE_KEYS.some(key => (newState as any)[key] !== (prevState as any)[key])
      if (appStateChanged) {
        if (appStateTimer) clearTimeout(appStateTimer)
        appStateTimer = setTimeout(() => {
          const snap = useTournamentStore.getState()
          const toSync: Partial<TournamentState> = {}
          for (const key of APP_STATE_KEYS) (toSync as any)[key] = (snap as any)[key]
          db.from('app_state').upsert({ id: APP_STATE_ID, state: toSync }, { onConflict: 'id' })
            .then(({ error }) => { if (error) console.error('[supabase] app_state upsert:', error.message) })
        }, 1000)
      }

      prevState = newState
    })

    // ── Initial fetch: pull current Supabase state on load ─────────────────

    ;(async () => {
      remoteDepth++
      try {
        const [appStateRes, matchesRes, teamScoresRes] = await Promise.all([
          db.from('app_state').select('state').eq('id', APP_STATE_ID).maybeSingle(),
          db.from('matches').select('match_json').eq('tournament_year', YEAR),
          db.from('team_scores')
            .select('team_id, round, points, notes').eq('tournament_year', YEAR),
        ])

        if (appStateRes.error) console.error('[supabase] fetch app_state:', appStateRes.error.message)
        if (matchesRes.error)  console.error('[supabase] fetch matches:',   matchesRes.error.message)
        if (teamScoresRes.error) console.error('[supabase] fetch team_scores:', teamScoresRes.error.message)

        // App state: Supabase wins if a row exists, else keep localStorage
        if (appStateRes.data?.state) {
          const updates: Partial<TournamentState> = {}
          for (const key of APP_STATE_KEYS) {
            if ((appStateRes.data.state as any)[key] !== undefined)
              (updates as any)[key] = (appStateRes.data.state as any)[key]
          }
          useTournamentStore.setState(updates)
        }

        // Matches: Supabase wins if rows exist
        if (matchesRes.data && matchesRes.data.length > 0) {
          useTournamentStore.setState({ matches: matchesRes.data.map((r: any) => r.match_json) })
        }

        // Team scores: Supabase wins if rows exist
        if (teamScoresRes.data && teamScoresRes.data.length > 0) {
          useTournamentStore.setState({
            teamScores: teamScoresRes.data.map((r: any) => ({
              teamId: r.team_id, round: r.round, points: r.points, notes: r.notes ?? undefined,
            })),
          })
        }
      } catch (err) {
        console.error('[supabase] initial fetch failed:', err)
      } finally {
        prevState = useTournamentStore.getState()
        remoteDepth--
      }
    })()

    return () => {
      unsubscribe()
      db.removeChannel(channel)
      if (appStateTimer) clearTimeout(appStateTimer)
      useSyncStatus.setState({ connected: false })
    }
  }, [])
}
