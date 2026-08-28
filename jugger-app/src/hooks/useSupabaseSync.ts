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
  'courseHistory', 'admins', 'pairingsLocked', 'lockedRounds', 'hioDonations', 'skidmoreScores',
  'sandbaggerPlayerId', 'toiletAwardPlayerId', 'defendingChampionTeamId', 'gameConfig', 'location', 'lodgingConfig', 'sideBets', 'ctpTeamIds', 'ctpMatchIds',
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
      if (useTournamentStore.getState().isViewingHistory) return
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
      if (useTournamentStore.getState().isViewingHistory) return
      remoteDepth++
      useTournamentStore.setState(state => {
        const updatedMatches = state.matches.some(m => m.id === match.id)
          ? state.matches.map(m => m.id === match.id ? match : m)
          : [...state.matches, match]

        // Propagate scores from a non-blind match to blind matches in the same round
        if (!match.isBlind) {
          const sourcePids = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
          return {
            matches: updatedMatches.map(m => {
              if (!m.isBlind || m.round !== match.round) return m
              const blindPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
              const overlay: Match['scores'] = {}
              for (const pid of sourcePids) {
                if (blindPids.includes(pid) && match.scores[pid]) {
                  overlay[pid] = { ...(m.scores[pid] ?? {}), ...match.scores[pid] }
                }
              }
              return Object.keys(overlay).length > 0 ? { ...m, scores: { ...m.scores, ...overlay } } : m
            }),
          }
        }
        return { matches: updatedMatches }
      })
      prevState = useTournamentStore.getState()
      remoteDepth--
    }

    function applyMatchDelete(matchId: string) {
      if (useTournamentStore.getState().isViewingHistory) return
      remoteDepth++
      useTournamentStore.setState(state => ({ matches: state.matches.filter(m => m.id !== matchId) }))
      prevState = useTournamentStore.getState()
      remoteDepth--
    }

    function applyTeamScore(row: { team_id: string; round: number; points: number; notes?: string | null }) {
      if (useTournamentStore.getState().isViewingHistory) return
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
      if (useTournamentStore.getState().isViewingHistory) return
      remoteDepth++
      useTournamentStore.setState(state => ({
        teamScores: state.teamScores.filter(s => !(s.teamId === teamId && s.round === round)),
      }))
      prevState = useTournamentStore.getState()
      remoteDepth--
    }

    // ── Real-time subscriptions ─────────────────────────────────────────────

    const channel = db.channel('jugger-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, payload => {
        const row = payload.new as any
        if (row?.id === APP_STATE_ID && row?.state) applyAppState(row.state)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, payload => {
        const row = payload.new as any
        if (row?.tournament_year === YEAR && row?.match_json) applyMatch(row.match_json)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
        const row = payload.new as any
        if (row?.tournament_year === YEAR && row?.match_json) applyMatch(row.match_json)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'matches' }, payload => {
        const row = payload.old as any
        if (row?.match_id && row?.tournament_year === YEAR) applyMatchDelete(row.match_id)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_scores' }, payload => {
        const row = payload.new as any
        if (row?.tournament_year === YEAR) applyTeamScore(row)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'team_scores' }, payload => {
        const row = payload.new as any
        if (row?.tournament_year === YEAR) applyTeamScore(row)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'team_scores' }, payload => {
        const row = payload.old as any
        if (row?.tournament_year === YEAR) applyTeamScoreDelete(row.team_id, row.round)
      })
      .subscribe(status => {
        console.log('[supabase] realtime status:', status)
        useSyncStatus.setState({ connected: status === 'SUBSCRIBED' })
      })

    // ── Local → Supabase: push store changes ────────────────────────────────

    const upsertMatch = (match: Match) =>
      db.from('matches').upsert(
        { match_id: match.id, tournament_year: YEAR, match_json: match },
        { onConflict: 'match_id' },
      ).then(({ error }) => { if (error) console.error('[supabase] match upsert:', error.message) })

    const unsubscribe = useTournamentStore.subscribe(newState => {
      // Skip: this setState came from Supabase, or admin is viewing historical data
      if (remoteDepth > 0 || newState.isViewingHistory) { prevState = newState; return }

      // Upsert changed or new matches
      if (newState.matches !== prevState.matches) {
        const changedOrNew = newState.matches.filter(m => {
          const old = prevState.matches.find(pm => pm.id === m.id)
          return old !== m
        })
        // Track which rounds had a non-blind match change so we can also push
        // the corresponding blind matches (safety net in case identity check misses them)
        const roundsWithRegularChange = new Set<number>()
        for (const match of changedOrNew) {
          upsertMatch(match)
          if (!match.isBlind) roundsWithRegularChange.add(match.round)
        }
        // Explicitly push blind matches for any round where a regular match changed
        for (const round of roundsWithRegularChange) {
          for (const blindMatch of newState.matches.filter(m => m.isBlind && m.round === round)) {
            if (!changedOrNew.find(m => m.id === blindMatch.id)) {
              upsertMatch(blindMatch)
            }
          }
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
    // IMPORTANT: remoteDepth is only held during synchronous setState calls,
    // NOT across the async fetch — otherwise local score entries during the
    // fetch window are blocked from being pushed to Supabase.

    ;(async () => {
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
          remoteDepth++
          const updates: Partial<TournamentState> = {}
          for (const key of APP_STATE_KEYS) {
            if ((appStateRes.data.state as any)[key] !== undefined)
              (updates as any)[key] = (appStateRes.data.state as any)[key]
          }
          useTournamentStore.setState(updates)
          prevState = useTournamentStore.getState()
          remoteDepth--
        }

        // Matches: merge Supabase wins per-hole so any local scores entered during
        // the fetch window are preserved rather than overwritten.
        if (matchesRes.data && matchesRes.data.length > 0) {
          const remoteMatches: Match[] = matchesRes.data.map((r: any) => r.match_json)
          remoteDepth++
          useTournamentStore.setState(state => {
            const merged = state.matches.map(local => {
              const remote = remoteMatches.find(r => r.id === local.id)
              if (!remote) return local
              // Merge per-player per-hole: remote wins unless local has a non-null value
              // that remote doesn't (score entered during the fetch window)
              const mergedScores: Match['scores'] = { ...remote.scores }
              for (const pid of Object.keys(local.scores)) {
                const localPlayerScores = local.scores[pid] ?? {}
                const remotePlayerScores = remote.scores[pid] ?? {}
                const mergedPlayer: Record<number, number | null> = { ...remotePlayerScores }
                for (const holeStr of Object.keys(localPlayerScores)) {
                  const hole = Number(holeStr)
                  if (localPlayerScores[hole] !== null && remotePlayerScores[hole] == null) {
                    mergedPlayer[hole] = localPlayerScores[hole]
                  }
                }
                mergedScores[pid] = mergedPlayer
              }
              return { ...remote, scores: mergedScores }
            })
            for (const r of remoteMatches) {
              if (!merged.find(m => m.id === r.id)) merged.push(r)
            }
            return { matches: merged }
          })
          prevState = useTournamentStore.getState()
          remoteDepth--
        }

        // Team scores: Supabase wins if rows exist
        if (teamScoresRes.data && teamScoresRes.data.length > 0) {
          remoteDepth++
          useTournamentStore.setState({
            teamScores: teamScoresRes.data.map((r: any) => ({
              teamId: r.team_id, round: r.round, points: r.points, notes: r.notes ?? undefined,
            })),
          })
          prevState = useTournamentStore.getState()
          remoteDepth--
        }
      } catch (err) {
        console.error('[supabase] initial fetch failed:', err)
      }
    })()

    // ── Polling fallback: re-fetch matches every 10s to catch missed realtime events ──
    // Merges per-hole to avoid overwriting any local score that hasn't been pushed yet.
    const POLL_MS = 10_000
    async function pollMatches() {
      if (useTournamentStore.getState().isViewingHistory) return
      const res = await db.from('matches').select('match_json').eq('tournament_year', YEAR)
      if (res.error || !res.data || res.data.length === 0) return
      const remoteMatches: Match[] = res.data.map((r: any) => r.match_json)
      remoteDepth++
      useTournamentStore.setState(state => {
        let changed = false
        const merged = state.matches.map(local => {
          const remote = remoteMatches.find(r => r.id === local.id)
          if (!remote) return local
          // Merge per-player per-hole: remote wins unless local has a value remote doesn't
          const mergedScores: Match['scores'] = { ...remote.scores }
          let scoresDiffer = false
          for (const pid of Object.keys(local.scores)) {
            const lps = local.scores[pid] ?? {}
            const rps = remote.scores[pid] ?? {}
            const mergedPlayer: Record<number, number | null> = { ...rps }
            for (const holeStr of Object.keys(lps)) {
              const hole = Number(holeStr)
              if (lps[hole] !== null && rps[hole] == null) {
                mergedPlayer[hole] = lps[hole]
                scoresDiffer = true
              } else if (rps[hole] !== lps[hole]) {
                scoresDiffer = true
              }
            }
            mergedScores[pid] = mergedPlayer
          }
          if (scoresDiffer || remote.result !== local.result || remote.magicBall1 !== local.magicBall1) {
            changed = true
            return { ...remote, scores: mergedScores }
          }
          return local
        })
        for (const r of remoteMatches) {
          if (!merged.find(m => m.id === r.id)) { merged.push(r); changed = true }
        }
        return changed ? { matches: merged } : {}
      })
      prevState = useTournamentStore.getState()
      remoteDepth--
    }
    const pollTimer = setInterval(pollMatches, POLL_MS)

    return () => {
      unsubscribe()
      db.removeChannel(channel)
      if (appStateTimer) clearTimeout(appStateTimer)
      clearInterval(pollTimer)
      useSyncStatus.setState({ connected: false })
    }
  }, [])
}
