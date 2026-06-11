import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { useTournamentStore } from '../store/useTournamentStore'
import ScorecardCard from '../components/ScorecardCard'
import { getMatchesForRound } from '../utils/pairings'
import { Printer } from 'lucide-react'

const ROUND_NAMES: Record<number, string> = {
  1: 'Round 1 — Team Match Play',
  2: 'Round 2 — Points Round',
  3: 'Round 3 — Texas Scramble',
  4: 'Round 4 — Individual Match Play',
  5: "Round 5 — Captain's Choice",
}

export default function PrintAll() {
  const { teams, matches, courses, roundConfigs, year } = useTournamentStore()
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    pageStyle: `
      @page { size: letter; margin: 0.35in; }
      body { font-size: 8pt; background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    `,
    documentTitle: `Jugger ${year} Scorecards`,
  })

  const rounds = [1, 2, 3, 4, 5]

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-serif font-bold text-masters-dark">Print All Scorecards</h1>
        <div className="card text-center py-12 text-gray-400">
          Generate pairings first, then return here to print all scorecards.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-serif font-bold text-masters-dark">Print All Scorecards</h1>
          <p className="text-sm text-gray-500 mt-0.5">2 scorecards per 8.5×11 page. Each card prints top and bottom half.</p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-base px-6 py-3" onClick={handlePrint}>
          <Printer size={18} />
          Print All Scorecards
        </button>
      </div>

      {/* Print preview */}
      <div ref={printRef}>
        {rounds.map(round => {
          const config = roundConfigs.find(r => r.round === round)
          const course = courses.find(c => c.id === config?.courseId)
          const roundMatches = getMatchesForRound(matches, round)
          if (!config || !course || roundMatches.length === 0) return null

          return (
            <div key={round}>
              {/* Round header (no-print preview label) */}
              <div className="no-print bg-masters-green text-white px-4 py-2 font-serif font-bold text-sm my-2 rounded">
                {ROUND_NAMES[round]} — {course.name} ({config.tee} tees)
                {config.date && ` · ${new Date(config.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                {config.teeTimes?.some(Boolean) && ` · ${config.teeTimes!.filter(Boolean).join(' / ')}`}
              </div>

              {/* Pair up matches 2-per-page */}
              {chunk(roundMatches, 2).map((pair, pi) => (
                <div key={pi} className="print-page-break bg-white border border-gray-200 mb-4 rounded no-print-border-reset">
                  <div className="scorecard-half">
                    <ScorecardCard match={pair[0]} teams={teams} course={course} config={config} />
                  </div>

                  {/* Cut line */}
                  <div style={{ display: 'flex', alignItems: 'center', margin: '0 12px', gap: 6, color: '#9ca3af' }}>
                    <span style={{ fontSize: 13, lineHeight: 1, transform: 'rotate(270deg)', display: 'inline-block', flexShrink: 0 }}>✂</span>
                    <div style={{ flex: 1, borderTop: '1.5px dashed #d1d5db' }} />
                    <span style={{ fontSize: 9, letterSpacing: '0.08em', flexShrink: 0, userSelect: 'none' }}>CUT</span>
                    <div style={{ flex: 1, borderTop: '1.5px dashed #d1d5db' }} />
                  </div>

                  {pair[1] ? (
                    <div className="scorecard-half">
                      <ScorecardCard match={pair[1]} teams={teams} course={course} config={config} />
                    </div>
                  ) : (
                    <div className="scorecard-half flex items-center justify-center text-gray-200">
                      <span className="font-serif text-sm">Juggerknocker Invitational {year}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}
