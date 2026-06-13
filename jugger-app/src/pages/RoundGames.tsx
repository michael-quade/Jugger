import { Navigate } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import { DEFAULT_GAME_CONFIG } from '../store/useTournamentStore'
import type { GameConfig, RoundFormat } from '../types'

const FORMAT_META: Record<RoundFormat, {
  name: string
  nickname?: string
  description: string
  mechanics: string[]
  hdcpNote: string
  hasBlinds: boolean
  isTeamFormat: boolean
}> = {
  team_match_play: {
    name: 'Team Match Play',
    nickname: 'Texas Twosome',
    description: 'Two-on-two best-ball match play. Teams split into two twosomes. Each twosome plays a head-to-head match against an opposing twosome using the best net score per hole. Most holes won wins the match.',
    mechanics: [
      'Each team sends out two twosomes (Twosome A = players 1+2, Twosome B = players 3+4)',
      'Each twosome plays its own match — best net score per hole counts',
      'Holes with no score recorded are halved',
      'Running hole total shown (+/− relative to opponent)',
      'Regular match: 2 pts · Blind match: 1 pt',
      'Tied match: 1 pt each (regular) · ½ pt each (blind)',
    ],
    hdcpNote: '100% full netted + capped course HDCP',
    hasBlinds: true,
    isTeamFormat: false,
  },
  points_round: {
    name: 'Points Round',
    nickname: 'Stableford',
    description: 'Each player earns gross Stableford points on every hole. The goal is for the twosome to accumulate as many points as possible relative to their combined Quota. The twosome closest to — or furthest over — their Quota wins the match.',
    mechanics: [
      'Twosome Quota = course par − (HDCP_A + HDCP_B). Example: par 72, HDCPs 10+10 → Quota = 52',
      'Points are earned gross (no stroke adjustments) — HDCP only sets your twosome\'s quota target',
      'Goal: accumulate twosome Stableford points at or above your combined Quota. Higher points-vs-quota wins',
      'Running score shows cumulative twosome points vs their combined quota (+/− means above/below quota)',
      'Magic Ball: a special ball assigned to the twosome for the match. Players alternate using it for entire holes (Player A uses it on hole 1, Player B on hole 2, etc.). The twosome still holding it at the end of the round earns +1 bonus point',
      'Regular match: 2 pts · Blind match: 1 pt · Tied match: 1 pt each · ½ pt each (blind)',
    ],
    hdcpNote: 'Full course HDCP; twosome quota = course par − (HDCP_A + HDCP_B)',
    hasBlinds: true,
    isTeamFormat: false,
  },
  texas_scramble: {
    name: 'Texas Scramble',
    nickname: undefined,
    description: 'All four players tee off. The team selects the best drive. Everyone plays from that spot. Repeat for each subsequent shot. Ball count rules escalate as the round progresses, forcing the team to use more players\' shots.',
    mechanics: [
      'Holes 1–6: Best 1 ball (any player\'s shot may be used)',
      'Holes 7–12: Best 2 balls (at least 2 different players\' shots must be used)',
      'Holes 13–15: Best 3 balls (at least 3 different players\' shots must be used)',
      'Holes 16–18: Best 4 balls (all 4 players\' shots must be used)',
      'Finish points: 1st = 4 pts · 2nd = 2 pts · 3rd = 1 pt',
      'No blind matches — one match per team (all 4 players together)',
    ],
    hdcpNote: 'Team HDCP = configurable % of standard course HDCP',
    hasBlinds: false,
    isTeamFormat: true,
  },
  individual_match: {
    name: 'Individual Match Play',
    description: 'Each player plays their own ball with full net scoring. Two simultaneous competitions run in each match: individual 1v1 between the paired players, and a twosome best-ball sub-match.',
    mechanics: [
      'Each player plays their own ball the entire round — no scramble, no best-ball selection',
      'Individual 1v1: each player scores a separate hole-by-hole match against their opponent',
      'Twosome sub-match: each twosome\'s best net score per hole competes against the opposing twosome',
      'Net per hole = gross − strokes received based on hole HDCP order',
      'Running status shown for both 1v1 matches and the twosome sub-match simultaneously',
      'Each individual match = 1 pt · Twosome sub-match = 1 pt · Blind = ½ pt',
    ],
    hdcpNote: '100% full netted + capped course HDCP',
    hasBlinds: true,
    isTeamFormat: false,
  },
  captains_choice: {
    name: "Captain's Choice",
    nickname: 'Skipper',
    description: "The team captain selects which player's shot to use on each stroke. All players tee off; the captain picks the best drive and everyone plays from there. Unlike a scramble, the captain has complete shot selection authority throughout.",
    mechanics: [
      'All 4 players tee off — captain selects the best drive',
      'Everyone plays from the chosen spot — captain selects the best approach, and so on',
      "Minimum 3 tee shots per player across 18 holes (configurable)",
      'Single shared team score for all 18 holes — no individual scoring',
      'Finish points: 1st = 4 pts · 2nd = 2 pts · 3rd = 1 pt',
      'No blind matches — one match per team (all 4 players together)',
    ],
    hdcpNote: 'Team HDCP = configurable % of summed individual HDCPs',
    hasBlinds: false,
    isTeamFormat: true,
  },
}

interface NumberInputProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  className?: string
}

function NumberInput({ value, onChange, min, max, step = 1, suffix, className = '' }: NumberInputProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(v)
        }}
        className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-masters-green"
      />
      {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
    </span>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-masters-green focus:ring-offset-1 ${checked ? 'bg-masters-green' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}

export default function RoundGames() {
  const isAdmin = useIsAdmin()
  if (!isAdmin) return <Navigate to="/" replace />

  const { gameConfig, setGameConfig, roundConfigs } = useTournamentStore(s => ({
    gameConfig: s.gameConfig,
    setGameConfig: s.setGameConfig,
    roundConfigs: s.roundConfigs,
  }))

  const cfg = gameConfig
  const update = <K extends keyof GameConfig>(key: K, value: GameConfig[K]) =>
    setGameConfig({ ...cfg, [key]: value })

  const reset = () => setGameConfig(DEFAULT_GAME_CONFIG)

  const assignedRound = (format: RoundFormat): number | null => {
    const rc = roundConfigs.find(r => r.format === format)
    return rc?.round ?? null
  }

  const pctDisplay = (v: number) => `${Math.round(v * 100)}%`

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="section-header">Round Games</h1>
          <p className="text-sm text-gray-500 mt-1">
            Game format rules and configurable house parameters. Changes take effect immediately for all scoring.
          </p>
        </div>
        <button onClick={reset} className="btn-ghost text-xs shrink-0 mt-1">
          Reset to Defaults
        </button>
      </div>

      {(Object.entries(FORMAT_META) as [RoundFormat, typeof FORMAT_META[RoundFormat]][]).map(([format, meta]) => {
        const round = assignedRound(format)
        return (
          <div key={format} className="card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-masters-light border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif font-bold text-masters-dark text-lg">{meta.name}</h2>
                    {meta.nickname && (
                      <span className="text-xs text-gray-500 italic">"{meta.nickname}"</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {meta.isTeamFormat && (
                      <span className="badge bg-masters-green text-white text-[10px] px-1.5 py-0.5">Team Format</span>
                    )}
                    {meta.hasBlinds && (
                      <span className="badge bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5">Includes Blinds</span>
                    )}
                  </div>
                </div>
              </div>
              {round && (
                <span className="shrink-0 text-xs font-semibold text-masters-green border border-masters-green rounded-full px-2.5 py-0.5">
                  Round {round}
                </span>
              )}
              {!round && (
                <span className="shrink-0 text-xs text-gray-400 italic">Not assigned</span>
              )}
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Description + Mechanics */}
              <div className="space-y-3">
                <p className="text-sm text-gray-700 leading-relaxed">{meta.description}</p>
                <div>
                  <h3 className="label mb-2">How It Works</h3>
                  <ul className="space-y-1.5">
                    {meta.mechanics.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="text-masters-green font-bold mt-0.5 shrink-0">•</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-xs text-gray-500 bg-masters-light rounded px-3 py-2">
                  <span className="font-semibold text-masters-dark">HDCP:</span> {meta.hdcpNote}
                </div>
              </div>

              {/* Right: Configurable Parameters */}
              <div className="space-y-4">
                <h3 className="label">House Rules & Parameters</h3>

                {format === 'texas_scramble' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Team HDCP %</div>
                        <div className="text-xs text-gray-500">Applied to each player's course HDCP</div>
                      </div>
                      <NumberInput
                        value={Math.round(cfg.texasScrambleHdcpPct * 100)}
                        onChange={v => update('texasScrambleHdcpPct', v / 100)}
                        min={0} max={100} step={5} suffix="%"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">1st Place Points</div>
                      </div>
                      <NumberInput value={cfg.teamFinish1stPts} onChange={v => update('teamFinish1stPts', v)} min={1} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">2nd Place Points</div>
                      </div>
                      <NumberInput value={cfg.teamFinish2ndPts} onChange={v => update('teamFinish2ndPts', v)} min={0} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">3rd Place Points</div>
                      </div>
                      <NumberInput value={cfg.teamFinish3rdPts} onChange={v => update('teamFinish3rdPts', v)} min={0} />
                    </div>
                    <div className="text-xs text-gray-400 italic">
                      Current: {pctDisplay(cfg.texasScrambleHdcpPct)} HDCP · {cfg.teamFinish1stPts}/{cfg.teamFinish2ndPts}/{cfg.teamFinish3rdPts} pts (1st/2nd/3rd)
                    </div>
                  </div>
                )}

                {format === 'captains_choice' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Team HDCP %</div>
                        <div className="text-xs text-gray-500">Applied to sum of all 4 individual HDCPs</div>
                      </div>
                      <NumberInput
                        value={Math.round(cfg.captainsChoiceHdcpPct * 100)}
                        onChange={v => update('captainsChoiceHdcpPct', v / 100)}
                        min={0} max={100} step={5} suffix="%"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Min Tee Balls per Player</div>
                        <div className="text-xs text-gray-500">Across all 18 holes · 0 = no minimum</div>
                      </div>
                      <NumberInput
                        value={cfg.captainsChoiceMinTeeBalls}
                        onChange={v => update('captainsChoiceMinTeeBalls', v)}
                        min={0} max={18}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">1st Place Points</div>
                      </div>
                      <NumberInput value={cfg.teamFinish1stPts} onChange={v => update('teamFinish1stPts', v)} min={1} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">2nd Place Points</div>
                      </div>
                      <NumberInput value={cfg.teamFinish2ndPts} onChange={v => update('teamFinish2ndPts', v)} min={0} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">3rd Place Points</div>
                      </div>
                      <NumberInput value={cfg.teamFinish3rdPts} onChange={v => update('teamFinish3rdPts', v)} min={0} />
                    </div>
                    <div className="text-xs text-gray-400 italic">
                      Current: {pctDisplay(cfg.captainsChoiceHdcpPct)} HDCP · min {cfg.captainsChoiceMinTeeBalls} tees · {cfg.teamFinish1stPts}/{cfg.teamFinish2ndPts}/{cfg.teamFinish3rdPts} pts
                    </div>
                  </div>
                )}

                {format === 'points_round' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Magic Ball</div>
                        <div className="text-xs text-gray-500">+1 pt bonus for twosome holding it at finish</div>
                      </div>
                      <Toggle
                        checked={cfg.enableMagicBall}
                        onChange={v => update('enableMagicBall', v)}
                        label={cfg.enableMagicBall ? 'On' : 'Off'}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Blind Matches</div>
                        <div className="text-xs text-gray-500">Applies to new pairing generation</div>
                      </div>
                      <Toggle
                        checked={cfg.enableBlinds}
                        onChange={v => update('enableBlinds', v)}
                        label={cfg.enableBlinds ? 'Yes' : 'No'}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Stableford Point Values</div>
                      <div className="space-y-1.5">
                        {([
                          ['Albatross (−3 or better)', 'stablefordAlbatross'],
                          ['Eagle (−2)', 'stablefordEagle'],
                          ['Birdie (−1)', 'stablefordBirdie'],
                          ['Par (E)', 'stablefordPar'],
                          ['Bogey (+1)', 'stablefordBogey'],
                          ['Double Bogey (+2)', 'stablefordDouble'],
                        ] as [string, keyof GameConfig][]).map(([label, key]) => (
                          <div key={key} className="flex items-center justify-between gap-4">
                            <span className="text-xs text-gray-600">{label}</span>
                            <NumberInput
                              value={cfg[key] as number}
                              onChange={v => update(key, v)}
                              min={0} max={20} step={0.5}
                            />
                          </div>
                        ))}
                        <div className="text-xs text-gray-400 italic pt-1">Triple bogey or worse = 0 pts (fixed)</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Regular Match Points</div>
                        <div className="text-xs text-gray-500">Awarded to winner of each regular match</div>
                      </div>
                      <NumberInput value={cfg.regularMatchPts} onChange={v => update('regularMatchPts', v)} min={1} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Blind Match Points</div>
                        <div className="text-xs text-gray-500">Awarded to winner of each blind match</div>
                      </div>
                      <NumberInput value={cfg.blindMatchPts} onChange={v => update('blindMatchPts', v)} min={0} step={0.5} />
                    </div>
                  </div>
                )}

                {format === 'team_match_play' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Blind Matches</div>
                        <div className="text-xs text-gray-500">Applies to new pairing generation</div>
                      </div>
                      <Toggle
                        checked={cfg.enableBlinds}
                        onChange={v => update('enableBlinds', v)}
                        label={cfg.enableBlinds ? 'Yes' : 'No'}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Regular Match Points</div>
                        <div className="text-xs text-gray-500">Awarded to winner</div>
                      </div>
                      <NumberInput value={cfg.regularMatchPts} onChange={v => update('regularMatchPts', v)} min={1} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Blind Match Points</div>
                        <div className="text-xs text-gray-500">Awarded to winner of blind match</div>
                      </div>
                      <NumberInput value={cfg.blindMatchPts} onChange={v => update('blindMatchPts', v)} min={0} step={0.5} />
                    </div>
                  </div>
                )}

                {format === 'individual_match' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Blind Matches</div>
                        <div className="text-xs text-gray-500">Applies to new pairing generation</div>
                      </div>
                      <Toggle
                        checked={cfg.enableBlinds}
                        onChange={v => update('enableBlinds', v)}
                        label={cfg.enableBlinds ? 'Yes' : 'No'}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Individual 1v1 Points</div>
                        <div className="text-xs text-gray-500">Per player head-to-head match</div>
                      </div>
                      <NumberInput value={cfg.regularMatchPts / 2} onChange={v => update('regularMatchPts', v * 2)} min={0.5} step={0.5} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Twosome Sub-Match Points</div>
                        <div className="text-xs text-gray-500">Best-ball twosome competition</div>
                      </div>
                      <NumberInput value={cfg.regularMatchPts / 2} onChange={v => update('regularMatchPts', v * 2)} min={0.5} step={0.5} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Blind Match Points</div>
                        <div className="text-xs text-gray-500">Per blind match winner</div>
                      </div>
                      <NumberInput value={cfg.blindMatchPts} onChange={v => update('blindMatchPts', v)} min={0} step={0.5} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Overall match structure note */}
      <div className="card p-5">
        <h2 className="font-serif font-bold text-masters-dark text-lg mb-3">Match Structure</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="label">Twosome Formats (Rounds 1, 2, 4)</h3>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-masters-green font-bold mt-0.5">•</span>
                3 regular matches + 3 blind matches per round
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-masters-green font-bold mt-0.5">•</span>
                Regular A: T1A vs T2A · Regular B: T1B vs T3A · Regular C: T2B vs T3B
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-masters-green font-bold mt-0.5">•</span>
                Blind 1: T3B vs T1A · Blind 2: T2A vs T3A · Blind 3: T2B vs T1B
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-masters-green font-bold mt-0.5">•</span>
                Each twosome plays 2 matches: 1 regular + 1 blind
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-masters-green font-bold mt-0.5">•</span>
                Blind matches are ideally against a different opponent team
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="label">Team Formats (Rounds 3, 5)</h3>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-masters-green font-bold mt-0.5">•</span>
                One match per team — all 4 players compete together
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-masters-green font-bold mt-0.5">•</span>
                No blind matches in team formats
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-masters-green font-bold mt-0.5">•</span>
                Teams ranked by score — points awarded by finish position
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-masters-green font-bold mt-0.5">•</span>
                Finish points: {cfg.teamFinish1stPts} pts (1st) · {cfg.teamFinish2ndPts} pts (2nd) · {cfg.teamFinish3rdPts} pts (3rd)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
