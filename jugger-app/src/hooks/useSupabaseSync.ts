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
    // Track the live year reactively so post-finalize sync uses the correct year
    // without requiring a page reload.
    let currentYear = useTournamentStore.getState().year
    const yearUnsub = useTournamentStore.subscribe(state => { currentYear = state.year })

    let prevState = useTournamentStore.getState()
    let appStateTimer: ReturnType<typeof setTimeout> | null = null
    // Per-match debounce timers — keyed by match id, cleared on delete
    const matchTimers = new Map<string, ReturnType<typeof setTimeout>>()

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
      if (match.id && useTournamentStore.getState().year !== currentYear) return
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
        if (row?.id === `jugger-${currentYear}` && row?.state) applyAppState(row.state)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, payload => {
        const row = payload.new as any
        if (row?.tournament_year === currentYear && row?.match_json) applyMatch(row.match_json)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
        const row = payload.new as any
        if (row?.tournament_year === currentYear && row?.match_json) applyMatch(row.match_json)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'matches' }, payload => {
        const row = payload.old as any
        if (row?.match_id && row?.tournament_year === currentYear) applyMatchDelete(row.match_id)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_scores' }, payload => {
        const row = payload.new as any
        if (row?.tournament_year === currentYear) applyTeamScore(row)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'team_scores' }, payload => {
        const row = payload.new as any
        if (row?.tournament_year === currentYear) applyTeamScore(row)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'team_scores' }, payload => {
        const row = payload.old as any
        if (row?.tournament_year === currentYear) applyTeamScoreDelete(row.team_id, row.round)
      })
      .subscribe(status => {
        console.log('[supabase] realtime status:', status)
        useSyncStatus.setState({ connected: status === 'SUBSCRIBED' })
      })

    // ── Local → Supabase: push store changes ────────────────────────────────

    // Debounce per-match upserts: score entry fires on every keystroke/stepper tap,
    // so we wait 500ms of silence before pushing to avoid saturating Supabase.
    const upsertMatchDebounced = (match: Match) => {
      if (matchTimers.has(match.id)) clearTimeout(matchTimers.get(match.id)!)
      matchTimers.set(match.id, setTimeout(() => {
        matchTimers.delete(match.id)
        db.from('matches').upsert(
          { match_id: match.id, tournament_year: currentYear, match_json: match },
          { onConflict: 'match_id' },
        ).then(({ error }) => { if (error) console.error('[supabase] match upsert:', error.message) })
      }, 500))
    }

    const unsubscribe = useTournamentStore.subscribe(newState => {
      // Skip: this setState came from Supabase, or admin is viewing historical data
      if (remoteDepth > 0 || newState.isViewingHistory) { prevState = newState; return }

      // Upsert changed or new matches (debounced per match)
      if (newState.matches !== prevState.matches) {
        const changedOrNew = newState.matches.filter(m => {
          const old = prevState.matches.find(pm => pm.id === m.id)
          return old !== m
        })
        for (const match of changedOrNew) {
          upsertMatchDebounced(match)
        }

        // Delete removed matches (e.g. pairings reset) — immediate, cancel any pending upsert
        const removed = prevState.matches.filter(pm => !newState.matches.find(nm => nm.id === pm.id))
        if (removed.length > 0) {
          for (const m of removed) {
            if (matchTimers.has(m.id)) { clearTimeout(matchTimers.get(m.id)!); matchTimers.delete(m.id) }
          }
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
            changed.map(s => ({ tournament_year: currentYear, team_id: s.teamId, round: s.round,
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
            .eq('tournament_year', currentYear).eq('team_id', score.teamId).eq('round', score.round)
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
          db.from('app_state').upsert({ id: `jugger-${currentYear}`, state: toSync }, { onConflict: 'id' })
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
        // ── Phase 1: fetch app_state FIRST (sequential) so we know the true live
        // year before deciding which tournament_year to fetch for matches/scores.
        const appStateRes = await db.from('app_state')
          .select('state').eq('id', `jugger-${currentYear}`).maybeSingle()
        if (appStateRes.error) console.error('[supabase] fetch app_state:', appStateRes.error.message)

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

        // ── Phase 2: determine whether YEAR (this session's captured year) is stale.
        // Check both what's now in the store (post-app_state) and what was in
        // localStorage before the fetch (archivedYears may already be there).
        const { liveYear: syncedLive, year: syncedYear, archivedYears: syncedArchived } =
          useTournamentStore.getState()
        const liveYear = syncedLive ?? syncedYear
        const yearIsStale = currentYear < liveYear ||
          (syncedArchived ?? []).some(a => a.year === currentYear)

        if (yearIsStale) {
          // currentYear belongs to an archived tournament. Clear local state immediately
          // and delete the stale rows from Supabase so every device stops seeing them.
          const staleYear = currentYear
          useTournamentStore.setState({ matches: [], teamScores: [] })
          db.from('matches').delete().eq('tournament_year', staleYear)
            .then(({ error }) => { if (error) console.error('[supabase] stale match cleanup:', error.message) })
          db.from('team_scores').delete().eq('tournament_year', staleYear)
            .then(({ error }) => { if (error) console.error('[supabase] stale score cleanup:', error.message) })
          return
        }

        // ── Phase 3: fetch matches/scores for the correct (current) year
        const fetchYear = currentYear
        const [matchesRes, teamScoresRes] = await Promise.all([
          db.from('matches').select('match_json').eq('tournament_year', fetchYear),
          db.from('team_scores')
            .select('team_id, round, points, notes').eq('tournament_year', fetchYear),
        ])
        if (matchesRes.error)    console.error('[supabase] fetch matches:',     matchesRes.error.message)
        if (teamScoresRes.error) console.error('[supabase] fetch team_scores:', teamScoresRes.error.message)

        if (!matchesRes.error) {
          if (matchesRes.data && matchesRes.data.length > 0) {
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
            useTournamentStore.setState({ matches: [] })
          }
        }

        if (!teamScoresRes.error) {
          if (teamScoresRes.data && teamScoresRes.data.length > 0) {
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
    // Only runs on the Scorecards pages where live score updates actually matter.
    // Merges per-hole to avoid overwriting any local score that hasn't been pushed yet.
    const POLL_MS = 10_000
    async function pollMatches() {
      // Only poll when the user is actually on the scorecards or mobile scoring page
      if (!window.location.hash.includes('/scorecards')) return
      if (useTournamentStore.getState().isViewingHistory) return
      const pollYear = currentYear
      const res = await db.from('matches').select('match_json').eq('tournament_year', pollYear)
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
      yearUnsub()
      unsubscribe()
      db.removeChannel(channel)
      if (appStateTimer) clearTimeout(appStateTimer)
      for (const t of matchTimers.values()) clearTimeout(t)
      matchTimers.clear()
      clearInterval(pollTimer)
      useSyncStatus.setState({ connected: false })
    }
  }, [])
}
