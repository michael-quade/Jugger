import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin, useIsPlayer, useAuthStore } from '../store/useAuthStore'
import { getMatchesForRound } from '../utils/pairings'
import { FORMAT_DISPLAY_NAMES, FORMAT_DESCRIPTIONS } from '../utils/sideBets'
import type {
  SideBetFormat, SideBetParticipant, SideBetConfig,
  NassauConfig, SkinsConfig, MatchMoneyConfig, StrokePlayConfig,
  DotsConfig, BingoBangoBongoConfig, WolfConfig, GroesomesConfig, VegasSideConfig,
  Match,
} from '../types'

const FORMATS: SideBetFormat[] = [
  'nassau', 'skins', 'match_money', 'stroke_play',
  'wolf', 'gruesomes', 'vegas_side', 'dots', 'bingo_bango_bongo',
]

const FORMAT_ROUND_FORMATS = {
  team_match_play: 'Team Match Play',
  points_round: 'Points Round',
  texas_scramble: 'Texas Scramble',
  individual_match: 'Individual Match',
  captains_choice: "Captain's Choice",
  vegas: 'Vegas',
}

function defaultConfig(format: SideBetFormat): SideBetConfig {
  switch (format) {
    case 'nassau':       return { front9: 5, back9: 5, overall: 5, autoPress: false, allowManualPress: false } as NassauConfig
    case 'skins':        return { amountPerSkin: 2, carryover: true } as SkinsConfig
    case 'match_money':  return { amountPerHole: 1 } as MatchMoneyConfig
    case 'stroke_play':  return { front9: 5, back9: 5, overall: 10, useNet: true } as StrokePlayConfig
    case 'dots':         return { amountPerDot: 1, birdie: true, eagle: true, sandy: true, greenie: true, ferret: false, poley: false, barky: false, customDots: [] } as DotsConfig
    case 'bingo_bango_bongo': return { amountPerPoint: 1 } as BingoBangoBongoConfig
    case 'wolf':         return { baseAmountPerHole: 1, wolfAloneMultiplier: 2 } as WolfConfig
    case 'gruesomes':    return { amountPerHole: 2 } as GroesomesConfig
    case 'vegas_side':   return { amountPerHole: 1, birdieMultiplier: 2, eagleMultiplier: 3 } as VegasSideConfig
  }
}

const STEPS = ['Format', 'Match', 'Players', 'Configure', 'Review']

function StepHeader({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center gap-2 ${i <= current ? 'text-masters-dark' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              i < current ? 'bg-masters-green text-white' :
              i === current ? 'bg-masters-gold text-white' :
              'bg-gray-200 text-gray-400'
            }`}>
              {i < current ? <Check size={12} /> : i + 1}
            </div>
            <span className="text-xs font-semibold hidden sm:inline">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 ${i < current ? 'bg-masters-green' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function NumberInput({ label, value, onChange, min = 0, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; step?: number
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type="number"
        className="input w-full mt-1"
        value={value}
        min={min}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  )
}

function ConfigStep({ format, config, onChange }: { format: SideBetFormat; config: SideBetConfig; onChange: (c: SideBetConfig) => void }) {
  const cfg = config as any

  function upd(key: string, val: unknown) {
    onChange({ ...cfg, [key]: val })
  }

  switch (format) {
    case 'nassau':
      return (
        <div className="space-y-4">
          <NumberInput label="Front 9 ($)" value={cfg.front9} onChange={v => upd('front9', v)} min={0} step={1} />
          <NumberInput label="Back 9 ($)" value={cfg.back9} onChange={v => upd('back9', v)} min={0} step={1} />
          <NumberInput label="Overall ($)" value={cfg.overall} onChange={v => upd('overall', v)} min={0} step={1} />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-masters-green" checked={cfg.autoPress} onChange={e => upd('autoPress', e.target.checked)} />
            <div>
              <span className="text-sm font-medium">Auto-Press</span>
              <p className="text-xs text-gray-500">Automatically triggers when a side goes 2 down</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-masters-green" checked={cfg.allowManualPress} onChange={e => upd('allowManualPress', e.target.checked)} />
            <div>
              <span className="text-sm font-medium">Allow Manual Press</span>
              <p className="text-xs text-gray-500">Either side can declare a press at any time during the round</p>
            </div>
          </label>
          {(cfg.autoPress || cfg.allowManualPress) && (
            <NumberInput label="Press Amount ($)" value={cfg.pressAmount ?? cfg.front9} onChange={v => upd('pressAmount', v)} min={0} step={1} />
          )}
        </div>
      )

    case 'skins':
      return (
        <div className="space-y-4">
          <NumberInput label="Amount Per Skin ($)" value={cfg.amountPerSkin} onChange={v => upd('amountPerSkin', v)} min={0} step={1} />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-masters-green" checked={cfg.carryover} onChange={e => upd('carryover', e.target.checked)} />
            <span className="text-sm font-medium">Carryover on ties</span>
          </label>
        </div>
      )

    case 'match_money':
      return (
        <NumberInput label="Amount Per Hole ($)" value={cfg.amountPerHole} onChange={v => upd('amountPerHole', v)} min={0} step={1} />
      )

    case 'stroke_play':
      return (
        <div className="space-y-4">
          <NumberInput label="Front 9 ($, 0 = skip)" value={cfg.front9} onChange={v => upd('front9', v)} min={0} step={1} />
          <NumberInput label="Back 9 ($, 0 = skip)" value={cfg.back9} onChange={v => upd('back9', v)} min={0} step={1} />
          <NumberInput label="Overall ($, 0 = skip)" value={cfg.overall} onChange={v => upd('overall', v)} min={0} step={1} />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-masters-green" checked={cfg.useNet} onChange={e => upd('useNet', e.target.checked)} />
            <span className="text-sm font-medium">Use net scores</span>
          </label>
        </div>
      )

    case 'dots':
      return (
        <div className="space-y-4">
          <NumberInput label="Amount Per Dot ($)" value={cfg.amountPerDot} onChange={v => upd('amountPerDot', v)} min={0} step={0.5} />
          <div>
            <p className="label mb-2">Dot Types</p>
            <div className="grid grid-cols-2 gap-2">
              {(['birdie', 'eagle', 'sandy', 'greenie', 'ferret', 'poley', 'barky'] as const).map(dot => (
                <label key={dot} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" className="w-4 h-4 accent-masters-green" checked={cfg[dot]} onChange={e => upd(dot, e.target.checked)} />
                  <span className="capitalize">{dot}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )

    case 'bingo_bango_bongo':
      return (
        <NumberInput label="Amount Per Point ($)" value={cfg.amountPerPoint} onChange={v => upd('amountPerPoint', v)} min={0} step={1} />
      )

    case 'wolf':
      return (
        <div className="space-y-4">
          <NumberInput label="Base Amount Per Hole ($)" value={cfg.baseAmountPerHole} onChange={v => upd('baseAmountPerHole', v)} min={0} step={1} />
          <NumberInput label="Wolf-Alone Multiplier" value={cfg.wolfAloneMultiplier} onChange={v => upd('wolfAloneMultiplier', v)} min={1} step={1} />
          <p className="text-xs text-gray-500">If Wolf goes alone and wins, they win base × multiplier.</p>
        </div>
      )

    case 'gruesomes':
      return (
        <NumberInput label="Amount Per Hole ($)" value={cfg.amountPerHole} onChange={v => upd('amountPerHole', v)} min={0} step={1} />
      )

    case 'vegas_side':
      return (
        <div className="space-y-4">
          <NumberInput label="Amount Per Hole ($)" value={cfg.amountPerHole} onChange={v => upd('amountPerHole', v)} min={0} step={1} />
          <NumberInput label="Birdie Multiplier" value={cfg.birdieMultiplier} onChange={v => upd('birdieMultiplier', v)} min={1} step={1} />
          <NumberInput label="Eagle Multiplier" value={cfg.eagleMultiplier} onChange={v => upd('eagleMultiplier', v)} min={1} step={1} />
        </div>
      )
  }
}

export default function SideBetCreate() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const isPlayer = useIsPlayer()
  const currentAdmin = useAuthStore(s => s.currentAdmin)
  const { teams, matches, roundConfigs, admins, year, createSideBet } = useTournamentStore()

  const [step, setStep] = useState(0)
  const [format, setFormat] = useState<SideBetFormat | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [mode, setMode] = useState<'1v1' | '2v2' | 'individual'>('2v2')
  const [participants, setParticipants] = useState<SideBetParticipant[]>([])
  const [config, setConfig] = useState<SideBetConfig | null>(null)

  // Player roster ID
  const playerRosterId = useMemo(() => {
    if (!currentAdmin) return null
    const cred = admins.find(a => a.username === currentAdmin)
    return cred?.playerId ?? cred?.subForPlayerId ?? null
  }, [currentAdmin, admins])

  const canAccess = isAdmin || isPlayer

  // All non-blind, non-complete matches across all rounds
  const eligibleMatches = useMemo(() => {
    const allMatches: Match[] = []
    for (let r = 1; r <= 5; r++) {
      const roundMatches = getMatchesForRound(matches, r).filter(m => !m.isBlind)
      allMatches.push(...roundMatches)
    }
    // Exclude matches where all 18 holes are scored for every player
    const holeNums = Array.from({ length: 18 }, (_, i) => i + 1)
    const incomplete = allMatches.filter(m => {
      const pids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
      return !pids.every(pid => holeNums.every(n => m.scores[pid]?.[n] != null))
    })
    if (isAdmin) return incomplete
    // Player only sees their own matches
    return incomplete.filter(m =>
      playerRosterId &&
      (m.twosome1.playerIds.includes(playerRosterId) || m.twosome2.playerIds.includes(playerRosterId))
    )
  }, [matches, isAdmin, playerRosterId])

  const selectedMatch = matches.find(m => m.id === selectedMatchId)
  const matchRc = selectedMatch ? roundConfigs.find(r => r.round === selectedMatch.round) : null

  // Get 4 players from the selected match
  const matchPlayers = useMemo(() => {
    if (!selectedMatch) return []
    const allPlayers = teams.flatMap(t => t.players)
    const pids = [...selectedMatch.twosome1.playerIds, ...selectedMatch.twosome2.playerIds]
    return pids.map(pid => {
      const player = allPlayers.find(p => p.id === pid)
      const team = teams.find(t => t.players.some(p => p.id === pid))
      return { pid, name: player?.name ?? pid, teamId: team?.id ?? '' }
    })
  }, [selectedMatch, teams])

  function toggleParticipant(pid: string, name: string, teamId: string, side: 'A' | 'B') {
    setParticipants(prev => {
      const existing = prev.find(p => p.playerId === pid)
      if (existing) {
        if (existing.side === side) return prev.filter(p => p.playerId !== pid)
        return prev.map(p => p.playerId === pid ? { ...p, side } : p)
      }
      const sideCount = prev.filter(p => p.side === side).length
      const maxPerSide = mode === '1v1' ? 1 : 2
      if (sideCount >= maxPerSide) return prev
      return [...prev, { playerId: pid, playerName: name, teamId, side }]
    })
  }

  function toggleIndividualParticipant(pid: string, name: string, teamId: string) {
    setParticipants(prev => {
      if (prev.some(p => p.playerId === pid)) return prev.filter(p => p.playerId !== pid)
      if (prev.length >= 4) return prev
      return [...prev, { playerId: pid, playerName: name, teamId, side: 'A' }]
    })
  }

  function changeMode(m: '1v1' | '2v2' | 'individual') {
    setMode(m)
    setParticipants([])
    if (format === 'skins' && config) {
      setConfig({ ...config, individualMode: m === 'individual' } as SkinsConfig)
    }
  }

  function canProceed(): boolean {
    switch (step) {
      case 0: return format !== null
      case 1: return selectedMatchId !== null
      case 2: {
        if (mode === 'individual') return participants.length >= 2
        const aCount = participants.filter(p => p.side === 'A').length
        const bCount = participants.filter(p => p.side === 'B').length
        if (mode === '1v1') return aCount === 1 && bCount === 1
        return aCount === 2 && bCount === 2
      }
      case 3: return config !== null
      case 4: return true
      default: return false
    }
  }

  function goNext() {
    if (step === 0 && format && !config) setConfig(defaultConfig(format))
    if (step < 4) setStep(s => s + 1)
  }

  function handleCreate() {
    if (!format || !selectedMatchId || !selectedMatch || !config || !currentAdmin) return
    createSideBet({
      year,
      matchId: selectedMatchId,
      round: selectedMatch.round,
      format,
      participants,
      config,
      holes: [],
      createdBy: currentAdmin,
      status: 'active',
    })
    navigate('/side-bets')
  }

  if (!canAccess) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Sign in as a player or admin to create side bets.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Back button */}
      <button onClick={() => navigate('/side-bets')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-masters-dark">
        <ChevronLeft size={16} />
        Back to Side Bets
      </button>

      <div className="card">
        <h1 className="text-xl font-serif font-bold text-masters-dark mb-4">Create Side Bet</h1>
        <StepHeader current={step} />

        {/* Step 0: Format */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-4">Choose a betting format</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FORMATS.map(f => (
                <button
                  key={f}
                  onClick={() => { setFormat(f); setConfig(defaultConfig(f)) }}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${
                    format === f
                      ? 'border-masters-green bg-masters-light'
                      : 'border-gray-200 hover:border-masters-green/50'
                  }`}
                >
                  <div className="font-semibold text-sm text-masters-dark">{FORMAT_DISPLAY_NAMES[f]}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{FORMAT_DESCRIPTIONS[f]}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Match */}
        {step === 1 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-4">Select the match this bet is for</p>
            {eligibleMatches.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-sm">No eligible matches found. Generate pairings first.</p>
            ) : (
              Object.entries(
                eligibleMatches.reduce((acc, m) => {
                  const key = `Round ${m.round}`
                  if (!acc[key]) acc[key] = []
                  acc[key].push(m)
                  return acc
                }, {} as Record<string, Match[]>)
              ).map(([roundLabel, roundMatches]) => (
                <div key={roundLabel}>
                  <p className="label mb-1">{roundLabel}</p>
                  {roundMatches.map(m => {
                    const allPlayers = teams.flatMap(t => t.players)
                    const pids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
                    const names = pids.map(pid => allPlayers.find(p => p.id === pid)?.name ?? pid)
                    const rc = roundConfigs.find(r => r.round === m.round)
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMatchId(m.id)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors mb-2 ${
                          selectedMatchId === m.id
                            ? 'border-masters-green bg-masters-light'
                            : 'border-gray-200 hover:border-masters-green/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{m.label}</span>
                          {rc && <span className="text-xs text-gray-400">{FORMAT_ROUND_FORMATS[rc.format] ?? rc.format}</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {names[0]} & {names[1]} vs {names[2]} & {names[3]}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {/* Step 2: Players */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['1v1', '2v2'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => changeMode(m)}
                  className={`flex-1 py-2 rounded font-semibold text-sm border-2 transition-colors ${
                    mode === m ? 'border-masters-green bg-masters-light text-masters-dark' : 'border-gray-200 text-gray-500 hover:border-masters-green/50'
                  }`}
                >
                  {m}
                </button>
              ))}
              {format === 'skins' && (
                <button
                  onClick={() => changeMode('individual')}
                  className={`flex-1 py-2 rounded font-semibold text-sm border-2 transition-colors ${
                    mode === 'individual' ? 'border-masters-green bg-masters-light text-masters-dark' : 'border-gray-200 text-gray-500 hover:border-masters-green/50'
                  }`}
                >
                  Individual
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {mode === '1v1' ? 'Select 1 player for each side.' :
               mode === 'individual' ? 'All selected players compete individually. Select 2–4 players.' :
               'Select 2 players for each side.'}
            </p>

            {mode === 'individual' ? (
              <>
                <div className="space-y-2">
                  {matchPlayers.map(({ pid, name, teamId }) => {
                    const selected = participants.some(p => p.playerId === pid)
                    return (
                      <div
                        key={pid}
                        onClick={() => toggleIndividualParticipant(pid, name, teamId)}
                        className={`flex items-center gap-3 p-2 border-2 rounded-lg cursor-pointer transition-colors ${
                          selected ? 'border-masters-green bg-masters-light' : 'border-gray-200 hover:border-masters-green/40'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-masters-green border-masters-green' : 'border-gray-300'}`}>
                          {selected && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-sm font-medium">{name}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500">{participants.length} player{participants.length !== 1 ? 's' : ''} selected</p>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  {matchPlayers.map(({ pid, name, teamId }) => {
                    const pSide = participants.find(p => p.playerId === pid)?.side
                    return (
                      <div key={pid} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
                        <span className="flex-1 text-sm font-medium">{name}</span>
                        {(['A', 'B'] as const).map(side => (
                          <button
                            key={side}
                            onClick={() => toggleParticipant(pid, name, teamId, side)}
                            className={`w-8 h-8 rounded font-bold text-sm transition-colors ${
                              pSide === side
                                ? side === 'A' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {side}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
                <div className="text-xs text-gray-500 flex gap-4">
                  <span>
                    <span className="text-blue-600 font-semibold">Side A:</span>{' '}
                    {participants.filter(p => p.side === 'A').map(p => p.playerName).join(', ') || 'None'}
                  </span>
                  <span>
                    <span className="text-red-600 font-semibold">Side B:</span>{' '}
                    {participants.filter(p => p.side === 'B').map(p => p.playerName).join(', ') || 'None'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Configure */}
        {step === 3 && format && config && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">Set the stakes for {FORMAT_DISPLAY_NAMES[format]}</p>
            <ConfigStep format={format} config={config} onChange={setConfig} />
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && format && selectedMatch && config && (
          <div className="space-y-4">
            <div className="bg-masters-light rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Format</span>
                <span className="font-semibold">{FORMAT_DISPLAY_NAMES[format]}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Match</span>
                <span className="font-semibold">{selectedMatch.label} · Round {selectedMatch.round}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Format</span>
                <span className="font-semibold">{matchRc ? FORMAT_ROUND_FORMATS[matchRc.format] : '—'}</span>
              </div>
              <hr className="border-gray-200" />
              <div className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-blue-600 font-semibold">Side A</span>
                  <span>{participants.filter(p => p.side === 'A').map(p => p.playerName).join(' & ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600 font-semibold">Side B</span>
                  <span>{participants.filter(p => p.side === 'B').map(p => p.playerName).join(' & ')}</span>
                </div>
              </div>
              <hr className="border-gray-200" />
              <div className="text-sm">
                <p className="text-gray-500 mb-1">Config</p>
                {Object.entries(config as unknown as Record<string, unknown>).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span>{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => step === 0 ? navigate('/side-bets') : setStep(s => s - 1)}
            className="btn-secondary flex items-center gap-1.5"
          >
            <ChevronLeft size={16} />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 4 ? (
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              className="btn-primary flex items-center gap-1.5"
            >
              <Check size={16} />
              Create Bet
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
