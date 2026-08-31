import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase, isSupabaseEnabled } from '../lib/supabase'
import { useTournamentStore } from '../store/useTournamentStore'
import type { TournamentState, Match, TeamRoundScore } from '../types'

export const useSyncStatus = create<{ connected: boolean }>(() => ({ connected: false }))

// Keys synced via the app_state table (everything except matches and teamScores)
const APP_STATE_KEYS: (keyof TournamentState)[] = [
  'year', 'liveYear', 'teams', 'courses', 'roundConfigs', 'holeInOnes',
  'ctpEntries', 'ctpDonations', 'ctpHioHistory', 'hdcpLocked',
  'courseHistory', 'admins', 'pairingsLocked', 'lockedRounds', 'hioDonations', 'skidmoreScores',
  'sandbaggerPlayerId', 'toiletAwardPlayerId', 'defendingChampionTeamId', 'gameConfig', 'location', 'lodgingConfig', 'sideBets', 'ctpTeamIds', 'ctpMatchIds',
  'archivedYears',
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
      // liveYear must equal year when not viewing history. Rows written before
      // liveYear was synced (or written pre-finalization) may be missing or stale.
      if (updates.year !== undefined &&
          ((state as any).liveYear === undefined || (state as any).liveYear < updates.year)) {
        updates.liveYear = updates.year
      }
      useTournamentStore.setState(updates)
      prevState = useTournamentStore.getState()
      remoteDepth--
    }

    // Merge remote scores onto local: remote wins per hole, but keep local value
    // if remote has null for that hole (prevents stale Supabase push from wiping
    // a score that was just entered locally but not yet confirmed).
    function mergeScores(local: Match['scores'], remote: Match['scores']): Match['scores'] {
      const merged: Match['scores'] = { ...remote }
      for (const pid of Object.keys(local)) {
        const lps = local[pid] ?? {}
        const rps = remote[pid] ?? {}
        const mergedPlayer: Record<number, number | null> = { ...rps }
        for (const holeStr of Object.keys(lps)) {
          const hole = Number(holeStr)
          if (lps[hole] !== null && rps[hole] == null) {
            mergedPlayer[hole] = lps[hole]
          }
        }
        merged[pid] = mergedPlayer
      }
      return merged
    }

    // Merge shotStats the same way: remote wins per hole, but local per-hole stat
    // is preserved when remote doesn't have one (concurrent scorers entering fairway/GIR).
    function mergeShotStats(
      local: Match['shotStats'],
      remote: Match['shotStats'],
    ): Match['shotStats'] {
      if (!local && !remote) return undefined
      const merged: NonNullable<Match['shotStats']> = { ...(remote ?? {}) }
      for (const pid of Object.keys(local ?? {})) {
        const lps = local![pid] ?? {}
        const rps = (remote ?? {})[pid] ?? {}
        const mergedPlayer: typeof lps = { ...rps }
        for (const holeStr of Object.keys(lps)) {
          const hole = Number(holeStr)
          if (rps[hole] == null) mergedPlayer[hole] = lps[hole]
        }
        merged[pid] = mergedPlayer
      }
      return merged
    }

    function mergeMatch(local: Match, remote: Match): Match {
      return {
        ...remote,
        scores: mergeScores(local.scores, remote.scores),
        shotStats: mergeShotStats(local.shotStats, remote.shotStats),
      }
    }

    function applyMatch(match: Match) {
      if (useTournamentStore.getState().isViewingHistory) return
      // Guard: if this session's YEAR drifted from the store's year (e.g. after
      // finalization applied a new year via app_state), don't re-apply old rows.
      if (YEAR !== useTournamentStore.getState().year) return
      remoteDepth++
      useTournamentStore.setState(state => {
        const localMatch = state.matches.find(m => m.id === match.id)
        // Always merge (never replace) so two devices entering scores/stats into
        // the same match don't overwrite each other's work.
        const mergedMatch: Match = localMatch ? mergeMatch(localMatch, match) : match
        const updatedMatches = localMatch
          ? state.matches.map(m => m.id === match.id ? mergedMatch : m)
          : [...state.matches, mergedMatch]

        // Propagate scores from a non-blind match to blind matches in the same round
        if (!match.isBlind) {
          const sourcePids = [...mergedMatch.twosome1.playerIds, ...mergedMatch.twosome2.playerIds]
          return {
            matches: updatedMatches.map(m => {
              if (!m.isBlind || m.round !== match.round) return m
              const blindPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
              const overlay: Match['scores'] = {}
              for (const pid of sourcePids) {
                if (blindPids.includes(pid) && mergedMatch.scores[pid]) {
                  overlay[pid] = { ...(m.scores[pid] ?? {}), ...mergedMatch.scores[pid] }
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
      if (YEAR !== useTournamentStore.getState().year) return
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
        for (const match of changedOrNew) {
          upsertMatch(match)
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
        if (changed.length > 0) {
          db.from('team_scores').upsert(
            changed.map(s => ({ tournament_year: YEAR, team_id: s.teamId, round: s.round,
              points: s.points, notes: s.notes ?? null })),
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
    // remoteDepth is held for the ENTIRE async fetch so no stale localStorage
    // state can be pushed to Supabase while the fetch is in flight. This is safe
    // because the match merge below preserves any local scores entered in the
    // window — those won't be pushed until the lock releases, but they won't
    // be lost either (merge keeps local non-null values where remote has null).

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
          const remoteState = appStateRes.data.state as any
          const updates: Partial<TournamentState> = {}
          for (const key of APP_STATE_KEYS) {
            if (remoteState[key] !== undefined)
              (updates as any)[key] = remoteState[key]
          }
          // liveYear must equal year on initial load. Rows written before liveYear
          // was synced (or written pre-finalization) may have a stale/missing value.
          if (updates.year !== undefined &&
              (remoteState.liveYear === undefined || remoteState.liveYear < updates.year)) {
            updates.liveYear = updates.year
          }
          useTournamentStore.setState(updates)
        }

        // Matches and team scores: Supabase is fully authoritative on initial load.
        // If the query succeeded (no error), apply whatever it returned — including
        // an empty result, which clears stale localStorage data from a prior year.
        // Guard: if app_state updated year to a different value than YEAR, the rows
        // were fetched for the wrong year — discard them and clear local state.
        const actualYear = useTournamentStore.getState().year

        if (!matchesRes.error) {
          if (YEAR === actualYear && matchesRes.data && matchesRes.data.length > 0) {
            const remoteMatches: Match[] = matchesRes.data.map((r: any) => r.match_json)
            useTournamentStore.setState(state => {
              const merged = state.matches.map(local => {
                const remote = remoteMatches.find(r => r.id === local.id)
                if (!remote) return local
                return mergeMatch(local, remote)
              })
              for (const r of remoteMatches) {
                if (!merged.find(m => m.id === r.id)) merged.push(r)
              }
              return { matches: merged }
            })
          } else {
            // Either year mismatch (wrong year fetched) or Supabase returned 0 rows
            // for the current year — both mean local matches should be empty.
            useTournamentStore.setState({ matches: [] })
          }
        }

        if (!teamScoresRes.error) {
          if (YEAR === actualYear && teamScoresRes.data && teamScoresRes.data.length > 0) {
            useTournamentStore.setState({
              teamScores: teamScoresRes.data.map((r: any) => ({
                teamId: r.team_id, round: r.round, points: r.points, notes: r.notes ?? undefined,
              })),
            })
          } else {
            useTournamentStore.setState({ teamScores: [] })
          }
        }
      } catch (err) {
        console.error('[supabase] initial fetch failed:', err)
      } finally {
        prevState = useTournamentStore.getState()
        remoteDepth--
      }
    })()

    // ── Polling fallback: re-fetch matches every 10s to catch missed realtime events ──
    // Merges per-hole to avoid overwriting any local score that hasn't been pushed yet.
    const POLL_MS = 10_000
    async function pollMatches() {
      if (useTournamentStore.getState().isViewingHistory) return
      // Guard: if the store year advanced past this session's captured YEAR (e.g.
      // after finalization), skip the poll — YEAR rows belong to the prior year.
      if (YEAR !== useTournamentStore.getState().year) return
      const res = await db.from('matches').select('match_json').eq('tournament_year', YEAR)
      if (res.error || !res.data || res.data.length === 0) return
      const remoteMatches: Match[] = res.data.map((r: any) => r.match_json)
      remoteDepth++
      useTournamentStore.setState(state => {
        let changed = false
        const merged = state.matches.map(local => {
          const remote = remoteMatches.find(r => r.id === local.id)
          if (!remote) return local
          if (remote === local) return local
          // Check for any meaningful difference before merging
          const scoresMatch = JSON.stringify(local.scores) === JSON.stringify(remote.scores)
          const statsMatch = JSON.stringify(local.shotStats) === JSON.stringify(remote.shotStats)
          if (scoresMatch && statsMatch && remote.result === local.result && remote.magicBall1 === local.magicBall1) return local
          changed = true
          return mergeMatch(local, remote)
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
