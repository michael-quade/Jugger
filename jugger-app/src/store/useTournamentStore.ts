import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TournamentState, ArchivedYear, Team, Player, Course, RoundConfig, Match, TeamRoundScore, HoleInOneEntry, CtpEntry, CtpDonation, CourseHistoryEntry, AdminCredential, HioDonation, SkidmoreScore, GameConfig, LodgingConfig } from '../types'
import { computeChampion } from '../utils/champion'
import { configureHdcpSettings } from '../utils/handicap'
import { INITIAL_TEAMS, INITIAL_COURSE_HISTORY, INITIAL_HIO_DONATIONS, INITIAL_CTP_HIO_HISTORY, INITIAL_SKIDMORE_SCORES } from '../data/initialData'
import { COURSES, ROUND_CONFIGS } from '../data/courseData'

interface Actions {
  setYear: (year: number) => void
  lockHandicaps: (locked: boolean) => void

  setTeams: (teams: Team[]) => void
  updatePlayer: (teamId: string, playerId: string, updates: Partial<Player>) => void
  addPlayer: (teamId: string, player: Player) => void
  removePlayer: (teamId: string, playerId: string) => void
  substitutePlayer: (teamId: string, playerId: string, subName: string, subHdcp: number) => void
  revertSubstitute: (teamId: string, playerId: string) => void
  permanentlyReplacePlayer: (teamId: string, playerId: string, newName: string, newHdcp: number, newGhin?: string) => void
  makeSubPermanent: (teamId: string, playerId: string) => void
  updateTeamName: (teamId: string, name: string) => void
  updateTeamColor: (teamId: string, color: string) => void

  setCourse: (course: Course) => void
  addCourse: (course: Course) => void
  removeCourse: (courseId: string) => void
  setRoundConfig: (config: RoundConfig) => void

  setMatches: (matches: Match[]) => void
  updateMatch: (matchId: string, updates: Partial<Match>) => void
  setMatchScore: (matchId: string, playerId: string, hole: number, score: number | null) => void
  setMatchScoresBatch: (matchId: string, scores: Match['scores']) => void
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
  lockRound: (round: number) => void
  unlockRound: (round: number) => void

  addHioDonation: (donation: HioDonation) => void
  setHioDonations: (donations: HioDonation[]) => void
  setCtpDonations: (donations: CtpDonation[]) => void
  setDonationPaid: (id: string, paid: boolean) => void
  claimPot: (hioId: string) => void
  claimPotForYear: (hioId: string, year: number) => void

  addSkidmoreScore: (score: Omit<SkidmoreScore, 'id'>) => void
  updateSkidmoreScore: (id: string, updates: Partial<Omit<SkidmoreScore, 'id'>>) => void
  removeSkidmoreScore: (id: string) => void

  setSandbaggerPlayer: (id: string | null) => void
  setToiletAwardPlayer: (id: string | null) => void
  setDefendingChampion: (teamId: string | null) => void
  setGameConfig: (config: GameConfig) => void
  setLocation: (location: string) => void
  setLodgingConfig: (config: LodgingConfig) => void

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

export const DEFAULT_GAME_CONFIG: GameConfig = {
  texasScrambleHdcpPct: 0.6,
  captainsChoiceHdcpPct: 0.15,
  captainsChoiceMinTeeBalls: 3,
  enableBlinds: true,
  enableMagicBall: true,
  stablefordAlbatross: 10,
  stablefordEagle: 6,
  stablefordBirdie: 4,
  stablefordPar: 2,
  stablefordBogey: 1,
  stablefordDouble: 0.5,
  regularMatchPts: 2,
  blindMatchPts: 1,
  teamFinish1stPts: 4,
  teamFinish2ndPts: 2,
  teamFinish3rdPts: 1,
  vegasBirdieMultiplier: 2,
  vegasEagleMultiplier: 3,
  vegasAlbatrossMultiplier: 4,
  vegasRegularMatchPts: 2,
  vegasBlindMatchPts: 1,
  vegasEnableBlinds: true,
}

const DEFAULT_LODGING_CONFIG: LodgingConfig = {
  propertyName: 'Talamore Golf Resort',
  address: '48 Talamore Drive, Southern Pines, NC 28387',
  websiteUrl: 'https://talamoregolfresort.com/lodging/talamore-villas/',
  description:
    'The 12-building Villa complex at Talamore Resort sits next to the clubhouse — you can easily walk to your round. ' +
    'Conveniently located about 5 miles from Downtown Southern Pines and 5 miles from the Village of Pinehurst. ' +
    'All three villas are in Building #6 on Woodbrooke Drive.',
  units: [
    { teamId: 'ballgame',    label: 'Villa 1611', building: 'Bldg #6', checkin: 'Wed, Aug 26', checkout: 'Sun, Aug 30', nights: 4, earlyArrival: true },
    { teamId: 'billy-baroo', label: 'Villa 1615', building: 'Bldg #6', checkin: 'Thu, Aug 27', checkout: 'Sun, Aug 30', nights: 3 },
    { teamId: 'silverbacks', label: 'Villa 1613', building: 'Bldg #6', checkin: 'Thu, Aug 27', checkout: 'Sun, Aug 30', nights: 3 },
  ],
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
  lockedRounds: [],
  hioDonations: INITIAL_HIO_DONATIONS,
  skidmoreScores: INITIAL_SKIDMORE_SCORES,
  sandbaggerPlayerId: 'pitts',
  toiletAwardPlayerId: 'skidmore',
  gameConfig: DEFAULT_GAME_CONFIG,
  location: 'Pinehurst, NC',
  lodgingConfig: DEFAULT_LODGING_CONFIG,
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

      substitutePlayer: (teamId, playerId, subName, subHdcp) =>
        set(state => ({
          teams: state.teams.map(t =>
            t.id !== teamId ? t : {
              ...t,
              players: t.players.map(p =>
                p.id !== playerId ? p : {
                  ...p,
                  name: subName,
                  handicapIndex: subHdcp,
                  ghinNumber: undefined,
                  isSubstitute: true,
                  originalName: p.isSubstitute ? p.originalName : p.name,
                  originalHandicapIndex: p.isSubstitute ? p.originalHandicapIndex : p.handicapIndex,
                  originalGhinNumber: p.isSubstitute ? p.originalGhinNumber : p.ghinNumber,
                }
              ),
            }
          ),
        })),

      revertSubstitute: (teamId, playerId) =>
        set(state => ({
          teams: state.teams.map(t =>
            t.id !== teamId ? t : {
              ...t,
              players: t.players.map(p =>
                p.id !== playerId ? p : {
                  ...p,
                  name: p.originalName ?? p.name,
                  handicapIndex: p.originalHandicapIndex ?? p.handicapIndex,
                  ghinNumber: p.originalGhinNumber,
                  isSubstitute: false,
                  originalName: undefined,
                  originalHandicapIndex: undefined,
                  originalGhinNumber: undefined,
                }
              ),
            }
          ),
        })),

      permanentlyReplacePlayer: (teamId, playerId, newName, newHdcp, newGhin) =>
        set(state => ({
          teams: state.teams.map(t =>
            t.id !== teamId ? t : {
              ...t,
              players: t.players.map(p =>
                p.id !== playerId ? p : {
                  ...p,
                  name: newName,
                  handicapIndex: newHdcp,
                  ghinNumber: newGhin ?? undefined,
                  isPermanentReplacement: true,
                  replacedPlayerName: p.replacedPlayerName ?? p.name,
                  isSubstitute: false,
                  originalName: undefined,
                  originalHandicapIndex: undefined,
                }
              ),
            }
          ),
        })),

      makeSubPermanent: (teamId, playerId) =>
        set(state => ({
          teams: state.teams.map(t =>
            t.id !== teamId ? t : {
              ...t,
              players: t.players.map(p =>
                p.id !== playerId ? p : {
                  ...p,
                  isPermanentReplacement: true,
                  replacedPlayerName: p.originalName ?? p.name,
                  isSubstitute: false,
                  originalName: undefined,
                  originalHandicapIndex: undefined,
                  originalGhinNumber: undefined,
                }
              ),
            }
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

      addCourse: (course) =>
        set(state => ({ courses: [...state.courses, course] })),

      removeCourse: (courseId) =>
        set(state => ({ courses: state.courses.filter(c => c.id !== courseId) })),

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

      setMatchScoresBatch: (matchId, scores) =>
        set(state => {
          const sourceMatch = state.matches.find(m => m.id === matchId)
          const propagate = sourceMatch && !sourceMatch.isBlind
          return {
            matches: state.matches.map(m => {
              if (m.id === matchId) return { ...m, scores: { ...m.scores, ...scores } }
              if (propagate && m.isBlind && m.round === sourceMatch!.round) {
                const blindPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
                const overlayScores: Match['scores'] = {}
                for (const pid of blindPids) {
                  if (scores[pid]) overlayScores[pid] = { ...(m.scores[pid] ?? {}), ...scores[pid] }
                }
                if (Object.keys(overlayScores).length > 0)
                  return { ...m, scores: { ...m.scores, ...overlayScores } }
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

      lockRound: (round) =>
        set(state => ({ lockedRounds: state.lockedRounds.includes(round) ? state.lockedRounds : [...state.lockedRounds, round] })),
      unlockRound: (round) =>
        set(state => ({ lockedRounds: state.lockedRounds.filter(r => r !== round) })),

      addHioDonation: (donation) =>
        set(state => ({ hioDonations: [...state.hioDonations, donation] })),

      setHioDonations: (donations) => set(() => ({ hioDonations: donations })),

      setCtpDonations: (donations) => set(() => ({ ctpDonations: donations })),

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

      claimPotForYear: (hioId, year) =>
        set(state => {
          const eligible = state.hioDonations.filter(d => d.paid && !d.claimedByHioId && d.year === year)
          const potAmount = eligible.reduce((sum, d) => sum + d.amount, 0)
          const eligibleIds = new Set(eligible.map(d => d.id))
          return {
            hioDonations: state.hioDonations.map(d =>
              eligibleIds.has(d.id) ? { ...d, claimedByHioId: hioId } : d
            ),
            holeInOnes: state.holeInOnes.map(h =>
              h.id !== hioId ? h : { ...h, potClaimed: potAmount }
            ),
          }
        }),

      addSkidmoreScore: (score) =>
        set(state => ({
          skidmoreScores: [
            ...state.skidmoreScores,
            { ...score, id: `sk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
          ],
        })),

      updateSkidmoreScore: (id, updates) =>
        set(state => ({
          skidmoreScores: state.skidmoreScores.map(s => s.id === id ? { ...s, ...updates } : s),
        })),

      removeSkidmoreScore: (id) =>
        set(state => ({
          skidmoreScores: state.skidmoreScores.filter(s => s.id !== id),
        })),

      setSandbaggerPlayer: (id) => set({ sandbaggerPlayerId: id ?? undefined }),
      setToiletAwardPlayer: (id) => set({ toiletAwardPlayerId: id ?? undefined }),
      setDefendingChampion: (teamId) => set({ defendingChampionTeamId: teamId ?? undefined }),
      setGameConfig: (config) => set({ gameConfig: config }),
      setLocation: (location) => set({ location }),
      setLodgingConfig: (lodgingConfig) => set({ lodgingConfig }),

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
          matches: state.matches.map(m => ({ ...m, scores: {}, teamHoleScores: {}, teeShotsUsed: {}, result: undefined, magicBall1: undefined, magicBall2: undefined })),
        })),

      clearAllTeamScores: () => set({ teamScores: [] }),

      clearTeamScoresForRound: (round) =>
        set(state => ({ teamScores: state.teamScores.filter(s => s.round !== round) })),

      clearRoundMatches: (round) =>
        set(state => ({ matches: state.matches.filter(m => m.round !== round) })),

      finalizeYear: () =>
        set(state => {
          // Persist Skidmore's tournament scores before matches are cleared
          const mattPlayer = state.teams.flatMap(t => t.players).find(
            p => p.id === 'skidmore' || p.name.toLowerCase().includes('skidmore')
          )
          const tournamentScoresToAdd: SkidmoreScore[] = []
          if (mattPlayer) {
            const seen = new Set<number>()
            for (const match of state.matches) {
              if (match.isBlind) continue
              const allIds = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
              if (!allIds.includes(mattPlayer.id)) continue
              if (seen.has(match.round)) continue
              const holeRecord = match.scores[mattPlayer.id] ?? {}
              const holeNums = Object.keys(holeRecord).map(Number)
              if (holeNums.length < 18) continue
              if (holeNums.some(h => holeRecord[h] === null || holeRecord[h] === undefined)) continue
              const rc = state.roundConfigs.find(r => r.round === match.round)
              if (!rc) continue
              if (rc.format === 'texas_scramble' || rc.format === 'captains_choice') continue
              const course = state.courses.find(c => c.id === rc.courseId)
              if (!course) continue
              const tee = course.tees.find(t => t.name === rc.tee) ?? course.tees[0]
              if (!tee?.rating || !tee?.slope) continue
              const total = holeNums.reduce((s, h) => s + (holeRecord[h] ?? 0), 0)
              seen.add(match.round)
              const id = `sk-tour-${state.year}-r${match.round}`
              if (!state.skidmoreScores.some(s => s.id === id)) {
                tournamentScoresToAdd.push({
                  id,
                  date: rc.date ?? `${state.year}-06-15`,
                  course: `${course.name} (${state.year} R${match.round})`,
                  rating: tee.rating,
                  slope: tee.slope,
                  score: total,
                  notes: `${state.year} Tournament Round ${match.round}`,
                })
              }
            }
          }

          // Determine this year's champion to carry forward as next year's defending champ
          const championResult = computeChampion(
            state.teams, state.teamScores,
            state.roundConfigs.map(r => r.round),
            state.defendingChampionTeamId,
          )
          const newDefendingChampionId = championResult.champion?.id

          // Archive WITH subs intact (accurate historical record)
          const snapshot: ArchivedYear = {
            year: state.year,
            finalizedAt: new Date().toISOString(),
            teams: state.teams,
            roundConfigs: state.roundConfigs,
            matches: state.matches,
            teamScores: state.teamScores,
            hdcpLocked: state.hdcpLocked,
            lodgingConfig: state.lodgingConfig,
          }
          // Restore original players for next year's template
          const restoredTeams = state.teams.map(t => ({
            ...t,
            players: t.players
              .filter(p => !p.id.startsWith('sub-'))
              .map(p => {
                if (p.isPermanentReplacement) {
                  // Graduate to core member — keep their name/hdcp, just clear the flags
                  return { ...p, isPermanentReplacement: false, replacedPlayerName: undefined }
                }
                if (p.isSubstitute) {
                  // Single-year sub: revert to original player for next year's template
                  return { ...p, name: p.originalName!, handicapIndex: p.originalHandicapIndex!, isSubstitute: false, originalName: undefined, originalHandicapIndex: undefined }
                }
                return p
              }),
          }))
          const newYear = state.year + 1
          return {
            archivedYears: [...state.archivedYears.filter(a => a.year !== state.year), snapshot],
            teams: restoredTeams,
            liveYear: newYear,
            year: newYear,
            matches: [],
            teamScores: [],
            hdcpLocked: false,
            isViewingHistory: false,
            liveCache: null,
            skidmoreScores: [...state.skidmoreScores, ...tournamentScoresToAdd],
            defendingChampionTeamId: newDefendingChampionId,
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
      version: 23,
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
        if (fromVersion < 14) {
          base.admins = (base.admins ?? []).map((a: any) => ({
            ...a,
            role: a.role ?? 'admin',
          }))
        }
        if (fromVersion < 15) {
          if (!base.skidmoreScores || base.skidmoreScores.length === 0) {
            base.skidmoreScores = INITIAL_SKIDMORE_SCORES
          }
        }
        if (fromVersion < 16) {
          const b = base as any
          if (!b.sandbaggerPlayerId) b.sandbaggerPlayerId = 'pitts'
          if (!b.toiletAwardPlayerId) b.toiletAwardPlayerId = 'skidmore'
        }
        if (fromVersion < 18) {
          const b = base as any
          if (!b.gameConfig) b.gameConfig = DEFAULT_GAME_CONFIG
        }
        if (fromVersion < 19) {
          const b = base as any
          if (!b.lockedRounds) b.lockedRounds = []
        }
        if (fromVersion < 20) {
          const b = base as any
          if (!b.location) b.location = 'Pinehurst, NC'
        }
        if (fromVersion < 21) {
          const b = base as any
          if (!b.gameConfig) b.gameConfig = DEFAULT_GAME_CONFIG
          if (b.gameConfig.vegasBirdieMultiplier === undefined) b.gameConfig.vegasBirdieMultiplier = 2
          if (b.gameConfig.vegasEagleMultiplier === undefined) b.gameConfig.vegasEagleMultiplier = 3
          if (b.gameConfig.vegasAlbatrossMultiplier === undefined) b.gameConfig.vegasAlbatrossMultiplier = 4
          if (b.gameConfig.vegasRegularMatchPts === undefined) b.gameConfig.vegasRegularMatchPts = 2
          if (b.gameConfig.vegasBlindMatchPts === undefined) b.gameConfig.vegasBlindMatchPts = 1
          if (b.gameConfig.vegasEnableBlinds === undefined) b.gameConfig.vegasEnableBlinds = true
        }
        if (fromVersion < 23) {
          const b = base as any
          if (!b.lodgingConfig) b.lodgingConfig = DEFAULT_LODGING_CONFIG
        }
        if (fromVersion < 22) {
          // Remove duplicate HIO and CTP donation records created by pre-fix Sync/Add-player behavior
          const b = base as any
          const players: any[] = (b.teams ?? []).flatMap((t: any) => t.players ?? [])
          function dedupDonations(donations: any[]): any[] {
            // For same-id records, prefer the one with playerId
            const bestById = new Map<string, any>()
            for (const d of donations) {
              const existing = bestById.get(d.id)
              if (!existing || (!existing.playerId && d.playerId)) bestById.set(d.id, d)
            }
            const unique = [...bestById.values()]
            const coveredByPlayerId = new Set(unique.filter(d => d.playerId).map(d => d.playerId))
            const coveredByCurrentName = new Set(
              unique.filter(d => !d.playerId && players.some((p: any) => p.name === d.playerName)).map(d => d.playerName)
            )
            return unique.filter(d => {
              if (d.playerId) return true
              const subPlayer = players.find((p: any) => p.isSubstitute && p.originalName === d.playerName)
              if (subPlayer) {
                if (coveredByPlayerId.has(subPlayer.id)) return false
                if (coveredByCurrentName.has(subPlayer.name)) return false
              }
              return true
            })
          }
          if (b.hioDonations) b.hioDonations = dedupDonations(b.hioDonations)
          if (b.ctpDonations) b.ctpDonations = dedupDonations(b.ctpDonations)
        }
        return base as TournamentState
      },
    }
  )
)

// Keep handicap module in sync with gameConfig (including on initial load)
{
  const { gameConfig } = useTournamentStore.getState()
  configureHdcpSettings(gameConfig)
}
useTournamentStore.subscribe(state => configureHdcpSettings(state.gameConfig))
