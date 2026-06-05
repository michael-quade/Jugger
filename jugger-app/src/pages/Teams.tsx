import { useState, Fragment } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import type { Player } from '../types'
import { Lock, Unlock, Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import {
  rawCourseHdcpDisplay, tournamentHdcp, nettedCourseHdcpRaw, apply18Cap,
} from '../utils/handicap'

export default function Teams() {
  const { teams, hdcpLocked, lockHandicaps, updatePlayer, addPlayer, removePlayer, updateTeamName } = useTournamentStore()
  const isAdmin = useIsAdmin()
  const [editName, setEditName] = useState<{ teamId: string; playerId: string; val: string } | null>(null)
  const [editTeamName, setEditTeamName] = useState<{ teamId: string; val: string } | null>(null)

  function addSubstitute(teamId: string) {
    const newPlayer: Player = {
      id: `sub-${Date.now()}`,
      name: 'New Player',
      handicapIndex: 15.0,
      hdcpLocked: false,
    }
    addPlayer(teamId, newPlayer)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-serif font-bold text-masters-dark">Team Rosters</h1>
        {isAdmin && (
          <button
            className={`flex items-center gap-2 ${hdcpLocked ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => lockHandicaps(!hdcpLocked)}
          >
            {hdcpLocked ? <Lock size={14} /> : <Unlock size={14} />}
            {hdcpLocked ? 'Handicaps Locked — Click to Unlock' : 'Lock All Handicaps'}
          </button>
        )}
      </div>

      {hdcpLocked && (
        <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800 flex items-center gap-2">
          <Lock size={16} />
          {isAdmin ? 'Handicaps are locked. Click the button above to unlock.' : 'Handicaps are locked by the administrator.'}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {teams.map(team => (
          <div key={team.id} className="card border-t-4 space-y-3 overflow-visible" style={{ borderTopColor: team.color }}>
            {/* Team name */}
            {isAdmin && editTeamName?.teamId === team.id ? (
              <div className="flex items-center gap-1">
                <input
                  className="input flex-1 text-lg font-bold"
                  value={editTeamName.val}
                  onChange={e => setEditTeamName({ ...editTeamName, val: e.target.value })}
                  autoFocus
                />
                <button onClick={() => { updateTeamName(team.id, editTeamName.val); setEditTeamName(null) }}>
                  <Check size={16} className="text-masters-green" />
                </button>
                <button onClick={() => setEditTeamName(null)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-xl flex-1" style={{ color: team.color }}>{team.name}</h2>
                {isAdmin && (
                  <button onClick={() => setEditTeamName({ teamId: team.id, val: team.name })}>
                    <Edit2 size={14} className="text-gray-400 hover:text-masters-green" />
                  </button>
                )}
              </div>
            )}

            {/* Players */}
            <div className="space-y-2">
              {team.players.map(player => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  teamId={team.id}
                  hdcpLocked={hdcpLocked}
                  isAdmin={isAdmin}
                  editName={editName}
                  setEditName={setEditName}
                  onUpdatePlayer={(id, updates) => updatePlayer(team.id, id, updates)}
                  onRemove={() => removePlayer(team.id, player.id)}
                />
              ))}
            </div>

            {isAdmin && !hdcpLocked && (
              <button
                className="btn-ghost w-full flex items-center justify-center gap-1 text-sm"
                onClick={() => addSubstitute(team.id)}
              >
                <Plus size={14} /> Add Substitute
              </button>
            )}
          </div>
        ))}
      </div>

      <HdcpTable />
    </div>
  )
}

// ─── HDCP Calculation Table (mirrors Excel HDCPs tab U1:AO20) ─────────────────

function HdcpTable() {
  const { teams, courses, roundConfigs } = useTournamentStore()
  const allPlayers = teams.flatMap(t => t.players)
  if (allPlayers.length === 0) return null

  const minIndex = Math.min(...allPlayers.map(p => p.handicapIndex))
  const minPlayer = allPlayers.find(p => p.handicapIndex === minIndex)!

  // Course + tee for each round (1–5)
  const courseRounds = ([1, 2, 3, 4, 5] as const).map(round => {
    const config = roundConfigs.find(r => r.round === round)
    const course = config ? courses.find(c => c.id === config.courseId) : undefined
    const tee = course && config ? (course.tees.find(t => t.name === config.tee) ?? course.tees[0]) : undefined
    return { round, course, tee }
  })

  const roundLabels: Record<number, string> = {
    1: 'Pine Needles', 2: 'Magnolia', 3: 'Holly (60%)', 4: 'Mid South', 5: 'Mid South',
  }

  // Per-player values for all 5 rounds
  function calcPlayer(index: number) {
    return courseRounds.map(({ round, course, tee }) => {
      if (!course || !tee) return null
      const { slope, rating } = tee
      const par = course.par
      const raw = rawCourseHdcpDisplay(index, slope, rating, par)
      const nettedRaw = nettedCourseHdcpRaw(index, slope, rating, par, minIndex)
      const capped = apply18Cap(nettedRaw)
      const final = round === 3 ? Math.round(capped * 0.6) : capped
      return { raw, nettedRaw, capped, final }
    })
  }

  const thCell = 'p-1.5 text-center border border-gray-200 font-semibold bg-masters-light'
  const thLeft = 'p-1.5 text-left border border-gray-200 font-semibold bg-masters-light'
  const td = 'p-1.5 text-center border border-gray-200'
  const tdLeft = 'p-1.5 text-left border border-gray-200'

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="section-header">Handicap Calculations</h2>
        <span className="text-xs text-gray-400 italic">
          Netting base: <strong className="text-masters-dark">{minPlayer.name}</strong> — {minIndex.toFixed(1)}
        </span>
      </div>

      <div className="text-xs text-gray-500 bg-masters-light/50 rounded p-3 space-y-1">
        <div>
          <strong>Course HDCP</strong> = Index × (Slope ÷ 113) + (Rating − Par)
        </div>
        <div>
          <strong>Tournament HDCP</strong> = player's rounded course HDCP − lowest player's rounded course HDCP.
          HDCPs above 18 are compressed: 18 + 50% of excess (e.g., 27 → 18 + 5 = 23).
          Round 3 applies an additional 60%.
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            {/* Course header row */}
            <tr>
              <th className={thLeft + ' min-w-[130px]'}>Player</th>
              <th className={thCell}>GHIN HDCP<br/>Index</th>
              {courseRounds.map(({ round, course, tee }) => (
                <th key={round} colSpan={2} className={thCell + ' border-l-2 border-l-masters-green/40'}>
                  <div>R{round} {roundLabels[round]}</div>
                  {tee && course && (
                    <div className="font-normal text-[9px] text-gray-400">
                      {tee.rating}/{tee.slope} par {course.par}
                    </div>
                  )}
                </th>
              ))}
            </tr>
            {/* Sub-header row */}
            <tr className="bg-gray-50">
              <th className={thLeft + ' text-[9px] font-normal text-gray-400'} />
              <th className={thCell + ' text-[9px] font-normal text-gray-400'} />
              {courseRounds.map(({ round }) => (
                <Fragment key={round}>
                  <th className="p-1 text-center border border-gray-200 text-[9px] font-normal text-gray-400 border-l-2 border-l-masters-green/40">
                    Raw
                  </th>
                  <th className="p-1 text-center border border-gray-200 text-[9px] font-normal text-gray-400">
                    HDCP
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map(team => {
              const playerCalcs = team.players.map(p => ({
                player: p,
                calcs: calcPlayer(p.handicapIndex),
              }))
              // Team 10%: ROUND(SUM(indices) * 0.1, 0)
              const team10pct = Math.round(team.players.reduce((s, p) => s + p.handicapIndex, 0) * 0.1)
              // Cap'n Choice: ROUND(SUM(R5 final HDCPs) * 0.15, 0)
              const r5Hdcps = playerCalcs.map(pc => pc.calcs[4]?.final ?? 0)
              const captChoice = Math.round(r5Hdcps.reduce((s, v) => s + v, 0) * 0.15)

              return (
                <Fragment key={team.id}>
                  {/* Team header */}
                  <tr>
                    <td
                      colSpan={2 + courseRounds.length * 2}
                      className="p-1.5 border border-gray-200 bg-masters-light/60"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: team.color }} />
                          <span className="font-bold text-xs" style={{ color: team.color }}>{team.name}</span>
                        </div>
                        <span className="text-[10px] text-gray-500">
                          Team 10% HDCP: <strong className="text-masters-dark">{team10pct}</strong>
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Cap'n Choice HDCP: <strong className="text-masters-dark">{captChoice}</strong>
                          <span className="text-gray-400 ml-1">(Σ R5 HDCPs {r5Hdcps.join('+')}={r5Hdcps.reduce((s,v)=>s+v,0)} × 15%)</span>
                        </span>
                      </div>
                    </td>
                  </tr>
                  {/* Player rows */}
                  {playerCalcs.map(({ player, calcs }) => (
                    <tr key={player.id} className="hover:bg-blue-50/30">
                      <td className={tdLeft + ' font-medium'}>{player.name}</td>
                      <td className={td + ' font-mono'}>{player.handicapIndex.toFixed(1)}</td>
                      {calcs.map((rv, ri) => (
                        <Fragment key={ri}>
                          <td className={td + ' text-gray-400 border-l-2 border-l-masters-green/40'}>
                            {rv?.raw.toFixed(1)}
                          </td>
                          <td className={td}>
                            {rv !== null && (
                              <div className="flex flex-col items-center leading-none gap-[1px]">
                                <span className="font-bold text-masters-green">{rv.final}</span>
                                {rv.nettedRaw !== rv.capped && (
                                  <span className="text-[8px] text-orange-400">
                                    {rv.nettedRaw}→{rv.capped}{ri === 2 ? `→${rv.final}` : ''}
                                  </span>
                                )}
                                {rv.nettedRaw === rv.capped && ri === 2 && rv.capped !== rv.final && (
                                  <span className="text-[8px] text-blue-400">{rv.capped}×60%</span>
                                )}
                              </div>
                            )}
                          </td>
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            {/* Netting base row */}
            <tr className="bg-gray-50 text-gray-400 italic">
              <td className={tdLeft + ' text-[10px]'}>Netting base ({minPlayer.name})</td>
              <td className={td + ' font-mono text-[10px]'}>{minIndex.toFixed(1)}</td>
              {courseRounds.map(({ round, course, tee }) => {
                if (!course || !tee) return <Fragment key={round}><td /><td /></Fragment>
                const baseRaw = rawCourseHdcpDisplay(minIndex, tee.slope, tee.rating, course.par)
                return (
                  <Fragment key={round}>
                    <td className={td + ' text-[10px] border-l-2 border-l-masters-green/40'}>
                      {baseRaw.toFixed(1)}
                    </td>
                    <td className={td + ' text-[10px]'}>0</td>
                  </Fragment>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function PlayerRow({
  player, teamId, hdcpLocked, isAdmin, editName, setEditName, onUpdatePlayer, onRemove
}: {
  player: Player
  teamId: string
  hdcpLocked: boolean
  isAdmin: boolean
  editName: { teamId: string; playerId: string; val: string } | null
  setEditName: (v: { teamId: string; playerId: string; val: string } | null) => void
  onUpdatePlayer: (id: string, updates: Partial<Player>) => void
  onRemove: () => void
}) {
  const isEditing = isAdmin && editName?.teamId === teamId && editName?.playerId === player.id
  const canEdit = isAdmin && !hdcpLocked

  return (
    <div className="border border-gray-200 rounded p-2 space-y-1">
      {/* Name row */}
      {isEditing ? (
        <div className="flex items-center gap-1">
          <input
            className="input flex-1 text-sm"
            value={editName!.val}
            onChange={e => setEditName({ ...editName!, val: e.target.value })}
            autoFocus
          />
          <button onClick={() => { onUpdatePlayer(player.id, { name: editName!.val }); setEditName(null) }}>
            <Check size={14} className="text-masters-green" />
          </button>
          <button onClick={() => setEditName(null)}>
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="font-semibold text-sm flex-1">{player.name}</span>
          {isAdmin && (
            <button onClick={() => setEditName({ teamId, playerId: player.id, val: player.name })}>
              <Edit2 size={12} className="text-gray-400 hover:text-masters-green" />
            </button>
          )}
          {isAdmin && (
            <button onClick={onRemove} title="Remove player">
              <Trash2 size={12} className="text-gray-300 hover:text-red-500" />
            </button>
          )}
        </div>
      )}

      {/* HDCP row */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400">HDCP Index:</span>
        {canEdit ? (
          <input
            type="number"
            step="0.1"
            min={0}
            max={54}
            className="border border-gray-200 rounded px-1 py-0.5 w-16 text-xs"
            value={player.handicapIndex}
            onChange={e => onUpdatePlayer(player.id, { handicapIndex: parseFloat(e.target.value) || 0 })}
          />
        ) : (
          <span className="font-bold text-masters-dark">{player.handicapIndex.toFixed(1)}</span>
        )}
        {player.hdcpLocked && <Lock size={10} className="text-masters-gold" />}
      </div>

      {/* GHIN row */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400">GHIN #:</span>
        {canEdit ? (
          <input
            className="border border-gray-200 rounded px-1 py-0.5 w-28 text-xs font-mono"
            placeholder="e.g. 1234567"
            value={player.ghinNumber ?? ''}
            onChange={e => onUpdatePlayer(player.id, { ghinNumber: e.target.value || undefined })}
          />
        ) : (
          <span className="font-mono text-masters-dark">
            {player.ghinNumber ?? <span className="text-gray-300">—</span>}
          </span>
        )}
      </div>
    </div>
  )
}
