import { useState } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import type { Player } from '../types'
import { Lock, Unlock, Plus, Trash2, Edit2, Check, X } from 'lucide-react'

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
          <div key={team.id} className="card border-t-4 space-y-3" style={{ borderTopColor: team.color }}>
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
