import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TournamentState, ArchivedYear, Team, Player, Course, RoundConfig, Match, TeamRoundScore, HoleInOneEntry, CtpEntry, CtpDonation, CourseHistoryEntry, AdminCredential, HioDonation } from '../types'
import { INITIAL_TEAMS, INITIAL_COURSE_HISTORY, INITIAL_HIO_DONATIONS, INITIAL_CTP_HIO_HISTORY } from '../data/initialData'
import { COURSES, ROUND_CONFIGS } from '../data/courseData'

interface Actions {
  setYear: (year: number) => void
  lockHandicaps: (locked: boolean) => void

  setTeams: (teams: Team[]) => void
  updatePlayer: (teamId: string, playerId: string, updates: Partial<Player>) => void
  addPlayer: (teamId: string, player: Player) => void
  removePlayer: (teamId: string, playerId: string) => void
  updateTeamName: (teamId: string, name: string) => void
  updateTeamColor: (teamId: string, color: string) => void

  setCourse: (course: Course) => void
  setRoundConfig: (config: RoundConfig) => void

  setMatches: (matches: Match[]) => void
  updateMatch: (matchId: string, updates: Partial<Match>) => void
  setMatchScore: (matchId: string, playerId: string, hole: number, score: number | null) => void
  setTeamHoleScore: (matchId: string, hole: number, score: number | null) => void
  setTeeShot: (matchId: string, hole: number, playerId: string | null) => void

  setTeamScore: (score: TeamRoundScore) => void

  addHoleInOne: (entry: HoleInOneEntry) => void
  updateHoleInOne: (id: string, updates: Partial<HoleInOneEntry>) => void
  deleteHoleInOne: (id: string) => void

  setCtpEntries: (entries: CtpEntry[]) => void
  updateCtpEntry: (id: string, updates: Partial<CtpEntry>) => void
  addCtpDonation: (donation: CtpDonation) => void
  setCtpDonationPaid: (id: string, paid: boolean) => void

  addCourseHistory: (entry: CourseHistoryEntry) => void
  updateCourseHistory: (id: string, updates: Partial<CourseHistoryEntry>) => void
  deleteCourseHistory: (id: string) => void

  addAdmin: (cred: AdminCredential) => void
  updateAdmin: (username: string, updates: Partial<AdminCredential>) => void
  removeAdmin: (username: string) => void
  setPairingsLocked: (locked: boolean) => void

  addHioDonation: (donation: HioDonation) => void
  setDonationPaid: (id: string, paid: boolean) => void
  claimPot: (hioId: string) => void

  clearMatchScores: (matchId: string) => void
  clearAllMatchScores: () => void
  clearAllTeamScores: () => void
  clearTeamScoresForRound: (round: number) => void
  clearRoundMatches: (round: number) => void

  finalizeYear: () => void
  switchToYear: (year: number) => void
  returnToLive: () => void

  resetAll: () => void
}

const DEFAULT_STATE: TournamentState = {
  year: new Date().getFullYear(),
  liveYear: new Date().getFullYear(),
  archivedYears: [],
  isViewingHistory: false,
  liveCache: null,
  teams: INITIAL_TEAMS,
  courses: COURSES,
  roundConfigs: ROUND_CONFIGS,
  matches: [],
  teamScores: [],
  holeInOnes: [],
  ctpEntries: [],
  ctpDonations: [],
  ctpHioHistory: INITIAL_CTP_HIO_HISTORY,
  hdcpLocked: false,
  courseHistory: INITIAL_COURSE_HISTORY,
  admins: [],
  pairingsLocked: false,
  hioDonations: INITIAL_HIO_DONATIONS,
}

export const useTournamentStore = create<TournamentState & Actions>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

      setYear: (year) => set({ year }),
      lockHandicaps: (hdcpLocked) => set({ hdcpLocked }),

      setTeams: (teams) => set({ teams }),

      updatePlayer: (teamId, playerId, updates) =>
        set(state => ({
          teams: state.teams.map(t =>
            t.id !== teamId ? t : {
              ...t,
              players: t.players.map(p => p.id !== playerId ? p : { ...p, ...updates }),
            }
          ),
        })),

      addPlayer: (teamId, player) =>
        set(state => ({
          teams: state.teams.map(t =>
            t.id !== teamId ? t : { ...t, players: [...t.players, player] }
          ),
        })),

      removePlayer: (teamId, playerId) =>
        set(state => ({
          teams: state.teams.map(t =>
            t.id !== teamId ? t : { ...t, players: t.players.filter(p => p.id !== playerId) }
          ),
        })),

      updateTeamName: (teamId, name) =>
        set(state => ({ teams: state.teams.map(t => t.id !== teamId ? t : { ...t, name }) })),

      updateTeamColor: (teamId, color) =>
        set(state => ({ teams: state.teams.map(t => t.id !== teamId ? t : { ...t, color }) })),

      setCourse: (course) =>
        set(state => ({
          courses: state.courses.some(c => c.id === course.id)
            ? state.courses.map(c => c.id === course.id ? course : c)
            : [...state.courses, course],
        })),

      setRoundConfig: (config) =>
        set(state => ({
          roundConfigs: state.roundConfigs.some(r => r.round === config.round)
            ? state.roundConfigs.map(r => r.round === config.round ? config : r)
            : [...state.roundConfigs, config],
        })),

      setMatches: (matches) => set({ matches }),

      updateMatch: (matchId, updates) =>
        set(state => ({
          matches: state.matches.map(m => m.id !== matchId ? m : { ...m, ...updates }),
        })),

      setTeamHoleScore: (matchId, hole, score) =>
        set(state => ({
          matches: state.matches.map(m =>
            m.id !== matchId ? m : { ...m, teamHoleScores: { ...m.teamHoleScores, [hole]: score } }
          ),
        })),

      setTeeShot: (matchId, hole, playerId) =>
        set(state => ({
          matches: state.matches.map(m => {
            if (m.id !== matchId) return m
            const updated = { ...m.teeShotsUsed }
            if (playerId === null) delete updated[hole]
            else updated[hole] = playerId
            return { ...m, teeShotsUsed: updated }
          }),
        })),

      setMatchScore: (matchId, playerId, hole, score) =>
        set(state => {
          const sourceMatch = state.matches.find(m => m.id === matchId)
          const propagate = sourceMatch && !sourceMatch.isBlind
          return {
            matches: state.matches.map(m => {
              const applyScore = (match: Match) => {
                const playerScores = { ...(match.scores[playerId] ?? {}), [hole]: score }
                return { ...match, scores: { ...match.scores, [playerId]: playerScores } }
              }
              if (m.id === matchId) return applyScore(m)
              if (propagate && m.isBlind && m.round === sourceMatch!.round) {
                const blindPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
                if (blindPids.includes(playerId)) return applyScore(m)
              }
              return m
            }),
          }
        }),

      setTeamScore: (score) =>
        set(state => {
          const existing = state.teamScores.findIndex(
            s => s.teamId === score.teamId && s.round === score.round
          )
          if (existing >= 0) {
            const updated = [...state.teamScores]
            updated[existing] = score
            return { teamScores: updated }
          }
          return { teamScores: [...state.teamScores, score] }
        }),

      addHoleInOne: (entry) =>
        set(state => ({ holeInOnes: [...state.holeInOnes, entry] })),

      updateHoleInOne: (id, updates) =>
        set(state => ({
          holeInOnes: state.holeInOnes.map(h => h.id !== id ? h : { ...h, ...updates }),
        })),

      deleteHoleInOne: (id) =>
        set(state => ({ holeInOnes: state.holeInOnes.filter(h => h.id !== id) })),

      setCtpEntries: (entries) => set({ ctpEntries: entries }),

      updateCtpEntry: (id, updates) =>
        set(state => ({
          ctpEntries: state.ctpEntries.map(c => c.id !== id ? c : { ...c, ...updates }),
        })),

      addCtpDonation: (donation) =>
        set(state => ({ ctpDonations: [...state.ctpDonations, donation] })),

      setCtpDonationPaid: (id, paid) =>
        set(state => ({
          ctpDonations: state.ctpDonations.map(d => d.id !== id ? d : { ...d, paid }),
        })),

      addCourseHistory: (entry) =>
        set(state => ({ courseHistory: [...state.courseHistory, entry] })),

      updateCourseHistory: (id, updates) =>
        set(state => ({
          courseHistory: state.courseHistory.map(c => c.id !== id ? c : { ...c, ...updates }),
        })),

      deleteCourseHistory: (id) =>
        set(state => ({ courseHistory: state.courseHistory.filter(c => c.id !== id) })),

      addAdmin: (cred) =>
        set(state => ({ admins: [...state.admins, cred] })),

      updateAdmin: (username, updates) =>
        set(state => ({
          admins: state.admins.map(a => a.username !== username ? a : { ...a, ...updates }),
        })),

      removeAdmin: (username) =>
        set(state => ({ admins: state.admins.filter(a => a.username !== username) })),

      setPairingsLocked: (pairingsLocked) => set({ pairingsLocked }),

      addHioDonation: (donation) =>
        set(state => ({ hioDonations: [...state.hioDonations, donation] })),

      setDonationPaid: (id, paid) =>
        set(state => ({
          hioDonations: state.hioDonations.map(d => d.id !== id ? d : { ...d, paid }),
        })),

      claimPot: (hioId) =>
        set(state => {
          const potAmount = state.hioDonations
            .filter(d => d.paid && !d.claimedByHioId)
            .reduce((sum, d) => sum + d.amount, 0)
          return {
            hioDonations: state.hioDonations.map(d =>
              d.paid && !d.claimedByHioId ? { ...d, claimedByHioId: hioId } : d
            ),
            holeInOnes: state.holeInOnes.map(h =>
              h.id !== hioId ? h : { ...h, potClaimed: potAmount }
            ),
          }
        }),

      clearMatchScores: (matchId) =>
        set(state => {
          const sourceMatch = state.matches.find(m => m.id === matchId)
          const isRegular = sourceMatch && !sourceMatch.isBlind
          const regularPids = sourceMatch
            ? [...sourceMatch.twosome1.playerIds, ...sourceMatch.twosome2.playerIds]
            : []
          return {
            matches: state.matches.map(m => {
              if (m.id === matchId) return { ...m, scores: {}, teamHoleScores: {}, teeShotsUsed: {}, result: undefined, magicBall1: undefined, magicBall2: undefined }
              if (isRegular && m.isBlind && m.round === sourceMatch!.round) {
                const blindPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
                const affected = regularPids.filter(pid => blindPids.includes(pid))
                if (affected.length > 0) {
                  const newScores = { ...m.scores }
                  affected.forEach(pid => { delete newScores[pid] })
                  return { ...m, scores: newScores, result: undefined }
                }
              }
              return m
            }),
          }
        }),

      clearAllMatchScores: () =>
        set(state => ({
          matches: state.matches.map(m => ({ ...m, scores: {}, result: undefined, magicBall1: undefined, magicBall2: undefined })),
        })),

      clearAllTeamScores: () => set({ teamScores: [] }),

      clearTeamScoresForRound: (round) =>
        set(state => ({ teamScores: state.teamScores.filter(s => s.round !== round) })),

      clearRoundMatches: (round) =>
        set(state => ({ matches: state.matches.filter(m => m.round !== round) })),

      finalizeYear: () =>
        set(state => {
          const snapshot: ArchivedYear = {
            year: state.year,
            finalizedAt: new Date().toISOString(),
            teams: state.teams,
            roundConfigs: state.roundConfigs,
            matches: state.matches,
            teamScores: state.teamScores,
            hdcpLocked: state.hdcpLocked,
          }
          const newYear = state.year + 1
          return {
            archivedYears: [...state.archivedYears.filter(a => a.year !== state.year), snapshot],
            liveYear: newYear,
            year: newYear,
            matches: [],
            teamScores: [],
            hdcpLocked: false,
            isViewingHistory: false,
            liveCache: null,
          }
        }),

      switchToYear: (targetYear) =>
        set(state => {
          if (targetYear === state.liveYear) {
            // Return to live year
            if (!state.liveCache) return { isViewingHistory: false }
            const updatedArchived = state.isViewingHistory
              ? state.archivedYears.map(a => a.year === state.year
                  ? { ...a, teams: state.teams, roundConfigs: state.roundConfigs, matches: state.matches, teamScores: state.teamScores, hdcpLocked: state.hdcpLocked }
                  : a)
              : state.archivedYears
            return {
              ...state.liveCache,
              liveYear: state.liveYear,
              archivedYears: updatedArchived,
              isViewingHistory: false,
              liveCache: null,
            }
          }
          const archived = state.archivedYears.find(a => a.year === targetYear)
          if (!archived) return state
          // Keep original live cache when already viewing history; create it otherwise
          const liveCache = state.isViewingHistory ? state.liveCache : {
            year: state.year, teams: state.teams, roundConfigs: state.roundConfigs,
            matches: state.matches, teamScores: state.teamScores, hdcpLocked: state.hdcpLocked,
          }
          // Save any edits to current historical year before switching
          const archivedYears = state.isViewingHistory
            ? state.archivedYears.map(a => a.year === state.year
                ? { ...a, teams: state.teams, roundConfigs: state.roundConfigs, matches: state.matches, teamScores: state.teamScores, hdcpLocked: state.hdcpLocked }
                : a)
            : state.archivedYears
          return {
            year: archived.year, teams: archived.teams, roundConfigs: archived.roundConfigs,
            matches: archived.matches, teamScores: archived.teamScores, hdcpLocked: archived.hdcpLocked,
            liveYear: state.liveYear, archivedYears, isViewingHistory: true, liveCache,
          }
        }),

      returnToLive: () =>
        set(state => {
          if (!state.liveCache) return { isViewingHistory: false }
          const updatedArchived = state.isViewingHistory
            ? state.archivedYears.map(a => a.year === state.year
                ? { ...a, teams: state.teams, roundConfigs: state.roundConfigs, matches: state.matches, teamScores: state.teamScores, hdcpLocked: state.hdcpLocked }
                : a)
            : state.archivedYears
          return {
            ...state.liveCache,
            liveYear: state.liveYear,
            archivedYears: updatedArchived,
            isViewingHistory: false,
            liveCache: null,
          }
        }),

      resetAll: () => set(DEFAULT_STATE),
    }),
    {
      name: 'jugger-tournament-2026',
      version: 13,
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = persisted as Partial<TournamentState>
        const base = { ...DEFAULT_STATE, ...state }
        if (fromVersion < 1) {
          base.courses = (state.courses ?? COURSES).map(c => {
            const def = COURSES.find(d => d.id === c.id)
            return def && !c.website ? { ...c, website: def.website } : c
          })
        }
        if (fromVersion < 2) {
          const userAdded = (state.courseHistory ?? []).filter(c => !c.id.startsWith('hist-'))
          base.courseHistory = [...INITIAL_COURSE_HISTORY, ...userAdded]
        }
        if (fromVersion < 3) {
          if (!base.admins) base.admins = []
          if (base.pairingsLocked === undefined) base.pairingsLocked = false
        }
        if (fromVersion < 4) {
          if (!base.hioDonations || base.hioDonations.length === 0) {
            base.hioDonations = INITIAL_HIO_DONATIONS
          }
        }
        if (fromVersion < 5) {
          if (!base.ctpDonations) base.ctpDonations = []
          if (!base.ctpHioHistory || base.ctpHioHistory.length === 0) {
            base.ctpHioHistory = INITIAL_CTP_HIO_HISTORY
          }
          // Discard old-style CtpEntries (they had different shape: playerName/distance instead of winnerName)
          base.ctpEntries = []
        }
        if (fromVersion < 6) {
          // Migrate teeTime → teeTimes, and populate dates/times from the 2026 Excel schedule
          base.roundConfigs = (base.roundConfigs ?? []).map(rc => {
            const defaults = ROUND_CONFIGS.find(d => d.round === rc.round)
            const existing = rc as any
            return {
              ...rc,
              date: rc.date ?? defaults?.date,
              teeTimes: rc.teeTimes ?? (existing.teeTime
                ? [existing.teeTime, defaults?.teeTimes?.[1] ?? '', defaults?.teeTimes?.[2] ?? ''] as [string,string,string]
                : defaults?.teeTimes),
            }
          })
        }
        if (fromVersion < 7) {
          // Patch imageUrl and website from INITIAL_COURSE_HISTORY onto existing hist-* entries
          base.courseHistory = (base.courseHistory ?? []).map(c => {
            if (!c.id.startsWith('hist-')) return c
            const def = INITIAL_COURSE_HISTORY.find(d => d.id === c.id)
            if (!def) return c
            return {
              ...c,
              imageUrl: c.imageUrl ?? def.imageUrl,
              website: c.website ?? def.website,
            }
          })
        }
        if (fromVersion < 8) {
          // Patch name, website, imageUrl, imageContain from INITIAL_COURSE_HISTORY onto hist-* entries
          base.courseHistory = (base.courseHistory ?? []).map(c => {
            if (!c.id.startsWith('hist-')) return c
            const def = INITIAL_COURSE_HISTORY.find(d => d.id === c.id)
            if (!def) return c
            return {
              ...c,
              name: def.name,
              website: def.website ?? c.website,
              imageUrl: def.imageUrl ?? c.imageUrl,
              imageContain: def.imageContain ?? c.imageContain,
            }
          })
        }
        if (fromVersion < 9) {
          // Force-update imageUrl/imageContain for built-in courses (switches hotlinked URLs to local assets)
          base.courseHistory = (base.courseHistory ?? []).map(c => {
            if (!c.id.startsWith('hist-')) return c
            const def = INITIAL_COURSE_HISTORY.find(d => d.id === c.id)
            if (!def) return c
            return { ...c, imageUrl: def.imageUrl, imageContain: def.imageContain }
          })
        }
        if (fromVersion < 12) {
          // Refresh tees and holes from COURSES for all built-in courses (adds new tees/yardages)
          base.courses = (base.courses ?? COURSES).map(c => {
            const def = COURSES.find(d => d.id === c.id)
            if (!def) return c
            return { ...c, tees: def.tees, holes: def.holes }
          })
        }
        if (fromVersion < 13) {
          const b = base as any
          if (b.liveYear === undefined)         b.liveYear = base.year
          if (b.archivedYears === undefined)    b.archivedYears = []
          if (b.isViewingHistory === undefined) b.isViewingHistory = false
          if (b.liveCache === undefined)        b.liveCache = null
        }
        return base as TournamentState
      },
    }
  )
)
