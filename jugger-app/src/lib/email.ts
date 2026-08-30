import { supabase } from './supabase'
import type { Match, Team, Course, RoundConfig, TeamRoundScore, CtpEntry, HioDonation } from '../types'

// ── Masters color palette (inline-style safe) ────────────────────────────────
const C = {
  dark:   '#1a3a2f',
  green:  '#006747',
  gold:   '#C9A84C',
  cream:  '#f5f5f0',
  light:  '#e8f0ec',
  white:  '#ffffff',
  gray:   '#6b7280',
  eagle:  '#d97706',   // amber
  birdie: '#16a34a',   // green
  par:    '#6b7280',
  bogey:  '#dc2626',   // red
  double: '#7c3aed',   // purple
}

const FORMAT_LABELS: Record<string, string> = {
  team_match_play:    'Team Match Play',
  points_round:       'Points Round (Stableford)',
  texas_scramble:     'Texas Scramble',
  individual_match:   'Individual Match Play',
  captains_choice:    "Captain's Choice",
  vegas:              'Vegas',
}

function fmtDate(d?: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function scoreColor(gross: number, par: number): string {
  const diff = gross - par
  if (diff <= -2) return C.eagle
  if (diff === -1) return C.birdie
  if (diff === 0)  return C.par
  if (diff === 1)  return C.bogey
  return C.double
}

function playerName(playerId: string, teams: Team[]): string {
  for (const t of teams) {
    const p = t.players.find(p => p.id === playerId)
    if (p) return p.name
  }
  return playerId
}

function teamForPlayer(playerId: string, teams: Team[]): Team | undefined {
  return teams.find(t => t.players.some(p => p.id === playerId))
}

// ── HTML shell ────────────────────────────────────────────────────────────────

function shell(year: number, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Juggerknocker Invitational ${year}</title>
</head>
<body style="margin:0;padding:0;background:#e5e7eb;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e5e7eb;padding:20px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.15);">

      <!-- Header -->
      <tr><td style="background:${C.dark};padding:24px 28px;text-align:center;">
        <div style="color:${C.gold};font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">A Tradition Unlike Any Other</div>
        <div style="color:${C.white};font-size:22px;font-weight:bold;letter-spacing:0.5px;">Juggerknocker Invitational</div>
        <div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:4px;">${year} Season</div>
      </td></tr>

      <!-- Content -->
      <tr><td style="padding:28px;background:${C.cream};">${body}</td></tr>

      <!-- Footer -->
      <tr><td style="background:${C.dark};padding:16px 28px;text-align:center;">
        <a href="https://juggerknockerinvitational.com" style="color:${C.gold};font-size:11px;text-decoration:none;letter-spacing:1px;">juggerknockerinvitational.com</a>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

function sectionHeader(title: string): string {
  return `<div style="font-size:13px;font-weight:bold;color:${C.dark};text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid ${C.gold};padding-bottom:6px;margin:24px 0 12px;">${title}</div>`
}

function teamPill(team: Team): string {
  return `<span style="display:inline-block;background:${team.color}22;color:${team.color};border:1px solid ${team.color}55;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:bold;">${team.name}</span>`
}

// ── Match scorecard table ─────────────────────────────────────────────────────

function matchScoreTable(match: Match, course: Course, teams: Team[]): string {
  const allPids = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
  const holes = course.holes.slice().sort((a, b) => a.number - b.number)

  const hdrStyle = `style="background:${C.dark};color:${C.white};font-size:11px;padding:4px 6px;text-align:center;"`
  const cellStyle = (color: string) => `style="font-size:12px;padding:4px 6px;text-align:center;color:${color};border-bottom:1px solid #e5e7eb;"`
  const parStyle = `style="font-size:11px;padding:4px 6px;text-align:center;color:${C.gray};background:${C.light};border-bottom:1px solid #e5e7eb;"`

  function halfTable(startHole: number, endHole: number): string {
    const rangeHoles = holes.filter(h => h.number >= startHole && h.number <= endHole)
    let rows = `<tr>
      <td ${hdrStyle}>Hole</td>
      ${rangeHoles.map(h => `<td ${hdrStyle}>${h.number}</td>`).join('')}
      <td ${hdrStyle}>TOT</td>
    </tr>
    <tr>
      <td ${parStyle}>Par</td>
      ${rangeHoles.map(h => `<td ${parStyle}>${h.par}</td>`).join('')}
      <td ${parStyle}>${rangeHoles.reduce((s, h) => s + h.par, 0)}</td>
    </tr>`

    for (const pid of allPids) {
      const scoreMap = match.scores[pid] ?? {}
      const halfScores = rangeHoles.map(h => scoreMap[h.number] ?? null)
      const total = halfScores.filter((s): s is number => s != null).reduce((a, b) => a + b, 0)
      const team = teamForPlayer(pid, teams)
      const name = playerName(pid, teams).split(' ')[0]
      rows += `<tr>
        <td style="font-size:11px;padding:4px 6px;color:${team?.color ?? C.dark};font-weight:bold;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${name}</td>
        ${rangeHoles.map((h, i) => {
          const s = halfScores[i]
          if (s == null) return `<td ${cellStyle(C.gray)}>—</td>`
          return `<td ${cellStyle(scoreColor(s, h.par))}>${s}</td>`
        }).join('')}
        <td ${cellStyle(C.dark)}><strong>${total || '—'}</strong></td>
      </tr>`
    }

    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #d1d5db;border-radius:6px;overflow:hidden;">${rows}</table>`
  }

  return halfTable(1, 9) + '<div style="height:12px;"></div>' + halfTable(10, 18)
}

// ── Public builders ───────────────────────────────────────────────────────────

export function buildMatchEmail(
  match: Match,
  teams: Team[],
  course: Course,
  roundConfig: RoundConfig,
  year: number,
  ctpEntries: CtpEntry[],
): { subject: string; html: string } {
  const t1pids = match.twosome1.playerIds
  const t2pids = match.twosome2.playerIds
  const t1 = teamForPlayer(t1pids[0], teams)
  const t2 = teamForPlayer(t2pids[0], teams)

  const t1Names = t1pids.map(id => playerName(id, teams)).join(' & ')
  const t2Names = t2pids.map(id => playerName(id, teams)).join(' & ')

  const roundCtp = ctpEntries.filter(e => e.year === year && e.round === roundConfig.round && e.winnerName)

  const body = `
    ${sectionHeader(`Round ${roundConfig.round} · ${match.label}${match.isBlind ? ' (Blind)' : ''}`)}

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:12px;color:${C.gray};padding-bottom:4px;">Format</td>
        <td style="font-size:12px;font-weight:bold;color:${C.dark};padding-bottom:4px;">${FORMAT_LABELS[roundConfig.format] ?? roundConfig.format}</td>
      </tr>
      <tr>
        <td style="font-size:12px;color:${C.gray};padding-bottom:4px;">Course</td>
        <td style="font-size:12px;font-weight:bold;color:${C.dark};padding-bottom:4px;">${course.name} · ${roundConfig.tee} tees</td>
      </tr>
      ${roundConfig.date ? `<tr>
        <td style="font-size:12px;color:${C.gray};padding-bottom:4px;">Date</td>
        <td style="font-size:12px;color:${C.dark};padding-bottom:4px;">${fmtDate(roundConfig.date)}</td>
      </tr>` : ''}
    </table>

    <div style="margin:16px 0;padding:14px;background:${C.white};border:1px solid #d1d5db;border-radius:6px;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div>
          ${t1 ? teamPill(t1) : ''}
          <div style="font-size:14px;font-weight:bold;color:${C.dark};margin-top:4px;">${t1Names}</div>
        </div>
        <div style="font-size:16px;color:${C.gray};flex:1;text-align:center;">vs</div>
        <div style="text-align:right;">
          ${t2 ? teamPill(t2) : ''}
          <div style="font-size:14px;font-weight:bold;color:${C.dark};margin-top:4px;">${t2Names}</div>
        </div>
      </div>
      ${match.result ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;font-size:15px;font-weight:bold;color:${C.green};">Result: ${match.result}</div>` : ''}
    </div>

    ${sectionHeader('Scores')}
    ${matchScoreTable(match, course, teams)}

    ${roundCtp.length ? `
      ${sectionHeader('Par 3 CTP')}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${roundCtp.map(e => `<tr>
          <td style="font-size:12px;padding:5px 0;color:${C.gray};">Hole ${e.hole}${e.yardage ? ` (${e.yardage} yds)` : ''}</td>
          <td style="font-size:12px;padding:5px 0;font-weight:bold;color:${C.dark};">${e.winnerName ?? ''}</td>
        </tr>`).join('')}
      </table>` : ''}
  `

  const subject = `[Jugger ${year}] R${roundConfig.round} ${match.label}: ${t1Names} vs ${t2Names}`
  return { subject, html: shell(year, body) }
}

function matchResultRow(m: Match, teams: Team[], dimmed = false): string {
  const t1pids = m.twosome1.playerIds
  const t2pids = m.twosome2.playerIds
  const t1 = teamForPlayer(t1pids[0], teams)
  const t2 = teamForPlayer(t2pids[0], teams)
  const t1Names = t1pids.map(id => playerName(id, teams)).join(' & ')
  const t2Names = t2pids.map(id => playerName(id, teams)).join(' & ')
  const opacity = dimmed ? 'opacity:0.75;' : ''
  return `<tr style="${opacity}">
    <td style="font-size:12px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-weight:bold;color:${C.dark};">${m.label}</td>
    <td style="font-size:12px;padding:6px 0;border-bottom:1px solid #f0f0f0;">
      <span style="color:${t1?.color ?? C.dark};">${t1Names}</span>
      <span style="color:${C.gray};margin:0 6px;">vs</span>
      <span style="color:${t2?.color ?? C.dark};">${t2Names}</span>
    </td>
    <td style="font-size:12px;padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:${C.green};font-weight:bold;">${m.result ?? '—'}</td>
  </tr>`
}

function blindDividerRow(): string {
  return `<tr>
    <td colspan="3" style="font-size:10px;padding:5px 0 3px;color:${C.gray};letter-spacing:1.5px;text-transform:uppercase;border-top:1px dashed #d1d5db;border-bottom:none;">Blind Matches</td>
  </tr>`
}

export function buildRoundEmail(
  round: number,
  matches: Match[],
  teams: Team[],
  course: Course,
  roundConfig: RoundConfig,
  teamScores: TeamRoundScore[],
  year: number,
  ctpEntries: CtpEntry[],
): { subject: string; html: string } {
  const regularMatches = matches.filter(m => m.round === round && !m.isBlind)
  const blindMatches = matches.filter(m => m.round === round && m.isBlind)
  const roundPts = teamScores.filter(s => s.round === round)
  const roundCtp = ctpEntries.filter(e => e.year === year && e.round === round && e.winnerName)

  const matchRows = [
    ...regularMatches.map(m => matchResultRow(m, teams)),
    ...(blindMatches.length ? [blindDividerRow(), ...blindMatches.map(m => matchResultRow(m, teams, true))] : []),
  ].join('')

  const ptsRows = teams.map(t => {
    const pts = roundPts.find(s => s.teamId === t.id)?.points ?? 0
    return `<tr>
      <td style="font-size:13px;padding:7px 0;border-bottom:1px solid #f0f0f0;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.color};margin-right:6px;vertical-align:middle;"></span>
        <strong>${t.name}</strong>
      </td>
      <td style="font-size:16px;font-weight:bold;padding:7px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:${C.dark};">${pts}</td>
    </tr>`
  }).join('')

  const body = `
    ${sectionHeader(`Round ${round} Results`)}

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:12px;color:${C.gray};padding-bottom:4px;">Format</td>
        <td style="font-size:12px;font-weight:bold;color:${C.dark};padding-bottom:4px;">${FORMAT_LABELS[roundConfig.format] ?? roundConfig.format}</td>
      </tr>
      <tr>
        <td style="font-size:12px;color:${C.gray};padding-bottom:4px;">Course</td>
        <td style="font-size:12px;font-weight:bold;color:${C.dark};padding-bottom:4px;">${course.name} · ${roundConfig.tee} tees</td>
      </tr>
      ${roundConfig.date ? `<tr>
        <td style="font-size:12px;color:${C.gray};padding-bottom:4px;">Date</td>
        <td style="font-size:12px;color:${C.dark};padding-bottom:4px;">${fmtDate(roundConfig.date)}</td>
      </tr>` : ''}
    </table>

    ${regularMatches.length ? `
      ${sectionHeader('Matches')}
      <table width="100%" cellpadding="0" cellspacing="0">${matchRows}</table>
    ` : ''}

    ${roundPts.length ? `
      ${sectionHeader('Round Points')}
      <table width="100%" cellpadding="0" cellspacing="0">${ptsRows}</table>
    ` : ''}

    ${roundCtp.length ? `
      ${sectionHeader('Par 3 CTP Winners')}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${roundCtp.map(e => `<tr>
          <td style="font-size:12px;padding:5px 0;color:${C.gray};">R${e.round} · Hole ${e.hole}${e.yardage ? ` (${e.yardage} yds)` : ''}</td>
          <td style="font-size:12px;padding:5px 0;font-weight:bold;color:${C.dark};">${e.winnerName}</td>
        </tr>`).join('')}
      </table>
    ` : ''}
  `

  const fmtLabel = FORMAT_LABELS[roundConfig.format] ?? roundConfig.format
  const subject = `[Jugger ${year}] Round ${round} Results — ${fmtLabel}`
  return { subject, html: shell(year, body) }
}

export function buildDayEmail(
  dayLabel: string,
  dayRounds: number[],
  allMatches: Match[],
  teams: Team[],
  teamScores: TeamRoundScore[],
  year: number,
  ctpEntries: CtpEntry[],
  roundConfigs: RoundConfig[],
  courses: Course[],
): { subject: string; html: string } {
  // Cumulative standings through all rounds played on this day and prior
  const maxRound = Math.max(...dayRounds)
  const cumScores = teams.map(t => ({
    team: t,
    total: teamScores.filter(s => s.teamId === t.id && s.round <= maxRound).reduce((s, r) => s + r.points, 0),
    byRound: [1, 2, 3, 4, 5].map(r => teamScores.find(s => s.teamId === t.id && s.round === r)?.points ?? 0),
  })).sort((a, b) => b.total - a.total)

  const standingsRows = cumScores.map((row, i) => `<tr style="background:${i === 0 ? '#fefce8' : C.white};">
    <td style="font-size:13px;padding:8px;border-bottom:1px solid #f0f0f0;">
      ${i === 0 ? '🏆 ' : ''}<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${row.team.color};margin-right:6px;vertical-align:middle;"></span>
      <strong>${row.team.name}</strong>
    </td>
    ${[1,2,3,4,5].map(r => `<td style="font-size:12px;padding:8px;text-align:center;border-bottom:1px solid #f0f0f0;color:${dayRounds.includes(r) ? C.dark : C.gray};">${row.byRound[r-1] || (dayRounds.includes(r) ? '0' : '—')}</td>`).join('')}
    <td style="font-size:14px;font-weight:bold;padding:8px;text-align:right;border-bottom:1px solid #f0f0f0;color:${C.dark};">${row.total}</td>
  </tr>`).join('')

  const roundSections = dayRounds.map(round => {
    const rc = roundConfigs.find(r => r.round === round)
    const course = rc ? courses.find(c => c.id === rc.courseId) : null
    const regularMatches = allMatches.filter(m => m.round === round && !m.isBlind)
    const blindMatches = allMatches.filter(m => m.round === round && m.isBlind)

    if (!rc || !course) return ''

    const matchRows = [
      ...regularMatches.map(m => matchResultRow(m, teams)),
      ...(blindMatches.length ? [blindDividerRow(), ...blindMatches.map(m => matchResultRow(m, teams, true))] : []),
    ].join('')

    return `
      <div style="margin:16px 0 8px;font-size:14px;font-weight:bold;color:${C.green};">
        Round ${round} · ${FORMAT_LABELS[rc.format] ?? rc.format}
        <span style="font-size:11px;color:${C.gray};font-weight:normal;margin-left:8px;">${course.name}</span>
      </div>
      ${regularMatches.length || blindMatches.length ? `<table width="100%" cellpadding="0" cellspacing="0">${matchRows}</table>` : '<div style="font-size:12px;color:#9ca3af;">No match data yet</div>'}
    `
  }).join('<div style="height:8px;border-top:1px dashed #e5e7eb;margin:12px 0;"></div>')

  const dayCtp = ctpEntries.filter(e => e.year === year && dayRounds.includes(e.round) && e.winnerName)

  const body = `
    ${sectionHeader(`${dayLabel} Results`)}

    ${roundSections}

    ${sectionHeader('Standings After Today')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #d1d5db;border-radius:6px;overflow:hidden;">
      <tr style="background:${C.dark};">
        <th style="color:${C.white};font-size:11px;padding:7px 8px;text-align:left;">Team</th>
        ${[1,2,3,4,5].map(r => `<th style="color:${dayRounds.includes(r) ? C.gold : 'rgba(255,255,255,0.35)'};font-size:11px;padding:7px 8px;text-align:center;">R${r}</th>`).join('')}
        <th style="color:${C.gold};font-size:11px;padding:7px 8px;text-align:right;">Total</th>
      </tr>
      ${standingsRows}
    </table>

    ${dayCtp.length ? `
      ${sectionHeader('Par 3 CTP')}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${dayCtp.map(e => `<tr>
          <td style="font-size:12px;padding:5px 0;color:${C.gray};">R${e.round} · Hole ${e.hole}${e.yardage ? ` (${e.yardage} yds)` : ''}</td>
          <td style="font-size:12px;padding:5px 0;font-weight:bold;color:${C.dark};">${e.winnerName}</td>
        </tr>`).join('')}
      </table>
    ` : ''}
  `

  const subject = `[Jugger ${year}] ${dayLabel} Recap`
  return { subject, html: shell(year, body) }
}

// ── Compose email (freeform admin message) ────────────────────────────────────

export function buildComposeEmail(year: number, subject: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, '<br>'))
    .map(p => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${C.dark};">${p}</p>`)
    .join('')

  const content = `
    <div style="font-size:13px;font-weight:bold;color:${C.dark};text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid ${C.gold};padding-bottom:6px;margin-bottom:20px;">${subject}</div>
    ${paragraphs}
  `
  return shell(year, content)
}

// ── Send via Supabase Edge Function ───────────────────────────────────────────

export interface EmailAttachment {
  filename: string
  content: string  // base64
}

export async function sendEmail(
  subject: string,
  html: string,
  recipients: string[],
  attachments?: EmailAttachment[],
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not configured' }
  if (!recipients.length) return { success: false, error: 'No recipients with email addresses' }

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { subject, html, recipients, attachments: attachments ?? [] },
    })
    if (error) return { success: false, error: error.message }
    if (data?.error) return { success: false, error: data.error }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ── Recipient helpers ─────────────────────────────────────────────────────────

export function getMatchRecipients(match: Match, teams: Team[]): string[] {
  const pids = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
  const emails: string[] = []
  for (const t of teams) {
    for (const p of t.players) {
      if (pids.includes(p.id) && p.playerEmail) emails.push(p.playerEmail)
    }
  }
  return [...new Set(emails)]
}

export function getRoundRecipients(round: number, matches: Match[], teams: Team[]): string[] {
  const roundPids = new Set<string>()
  for (const m of matches) {
    if (m.round === round && !m.isBlind) {
      m.twosome1.playerIds.forEach(id => roundPids.add(id))
      m.twosome2.playerIds.forEach(id => roundPids.add(id))
    }
  }
  const emails: string[] = []
  for (const t of teams) {
    for (const p of t.players) {
      if (roundPids.has(p.id) && p.playerEmail) emails.push(p.playerEmail)
    }
  }
  return [...new Set(emails)]
}

export function getAllRecipients(teams: Team[]): string[] {
  const emails: string[] = []
  for (const t of teams) {
    for (const p of t.players) {
      if (p.playerEmail) emails.push(p.playerEmail)
    }
  }
  return [...new Set(emails)]
}

// ── Tournament Summary Email ──────────────────────────────────────────────────

export function buildTournamentSummaryEmail(
  year: number,
  teams: Team[],
  matches: Match[],
  teamScores: TeamRoundScore[],
  roundConfigs: RoundConfig[],
  courses: Course[],
  ctpEntries: CtpEntry[],
  hioDonations: HioDonation[],
  ctpHioHistory: { year: number; amount: number }[],
  sandbaggerPlayerId?: string,
  toiletAwardPlayerId?: string,
  championTeamId?: string,
): { subject: string; html: string } {
  const sortedConfigs = [...roundConfigs].sort((a, b) => a.round - b.round)

  // ── Standings ──────────────────────────────────────────────────────────────
  const standing = teams.map(t => ({
    team: t,
    byRound: [1, 2, 3, 4, 5].map(r => teamScores.find(s => s.teamId === t.id && s.round === r)?.points ?? 0),
    total: teamScores.filter(s => s.teamId === t.id).reduce((s, r) => s + r.points, 0),
  })).sort((a, b) => b.total - a.total)

  const champion = teams.find(t => t.id === championTeamId) ?? standing[0]?.team

  // ── Champion banner ────────────────────────────────────────────────────────
  const championSection = champion ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;margin-bottom:20px;border:2px solid ${champion.color};">
      <tr><td style="background:linear-gradient(180deg,#060d08 0%,#0b1610 100%);padding:28px;text-align:center;">
        <div style="height:3px;background:linear-gradient(90deg,transparent,${champion.color},transparent);margin-bottom:18px;"></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">${year} Juggerknocker Invitational Champions</div>
        <div style="font-size:52px;line-height:1;margin:8px 0;">🏆</div>
        <div style="font-size:28px;font-weight:bold;color:${champion.color};margin:8px 0;">${champion.name}</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.6);">
          ${champion.players.map(p => p.name).join(' · ')}
        </div>
        <div style="margin-top:14px;font-size:20px;font-weight:bold;color:${C.gold};">
          ${standing.find(s => s.team.id === champion.id)?.total ?? '—'} pts
        </div>
      </td></tr>
    </table>
  ` : ''

  // ── Final Standings table ─────────────────────────────────────────────────
  const standingRows = standing.map((row, i) => {
    const isWinner = row.team.id === champion?.id
    const bg = isWinner ? '#fefce8' : (i % 2 === 0 ? C.white : C.cream)
    return `<tr style="background:${bg};">
      <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">
        ${isWinner ? '🏆 ' : ''}<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${row.team.color};margin-right:6px;vertical-align:middle;"></span>
        <strong>${row.team.name}</strong>
      </td>
      ${row.byRound.map(pts => `<td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;color:${C.gray};">${pts || '—'}</td>`).join('')}
      <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:15px;font-weight:bold;color:${C.dark};">${row.total}</td>
    </tr>`
  }).join('')

  const standingsSection = `
    ${sectionHeader('Final Standings')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #d1d5db;border-radius:6px;overflow:hidden;">
      <tr style="background:${C.dark};">
        <th style="color:${C.white};font-size:11px;padding:7px 10px;text-align:left;">Team</th>
        ${[1,2,3,4,5].map(r => `<th style="color:${C.gold};font-size:11px;padding:7px 10px;text-align:center;">R${r}</th>`).join('')}
        <th style="color:${C.gold};font-size:11px;padding:7px 10px;text-align:right;">Total</th>
      </tr>
      ${standingRows}
    </table>
  `

  // ── Round-by-round recap ──────────────────────────────────────────────────
  const roundSections = sortedConfigs.map(rc => {
    const course = courses.find(c => c.id === rc.courseId)
    const regularMatches = matches.filter(m => m.round === rc.round && !m.isBlind)
    const blindMatches = matches.filter(m => m.round === rc.round && m.isBlind)
    const roundPts = teamScores.filter(s => s.round === rc.round)
    const roundCtp = ctpEntries.filter(e => e.year === year && e.round === rc.round && e.winnerName)

    const matchRows = [
      ...regularMatches.map(m => matchResultRow(m, teams)),
      ...(blindMatches.length ? [blindDividerRow(), ...blindMatches.map(m => matchResultRow(m, teams, true))] : []),
    ].join('')

    const ptsRow = [...roundPts].sort((a, b) => b.points - a.points).map(s => {
      const t = teams.find(t => t.id === s.teamId)
      return `<span style="display:inline-block;margin-right:14px;font-size:12px;color:${t?.color ?? C.dark};font-weight:bold;">${t?.name ?? s.teamId}: ${s.points} pts</span>`
    }).join('')

    const ctpSnippet = roundCtp.length ? roundCtp.map(e =>
      `<span style="margin-right:14px;font-size:12px;color:${C.gray};">Hole ${e.hole}: <strong style="color:${C.dark};">${e.winnerName}</strong></span>`
    ).join('') : ''

    return `
      <div style="margin:0 0 4px;">
        <div style="font-size:13px;font-weight:bold;color:${C.green};margin:18px 0 4px;">
          Round ${rc.round} · ${FORMAT_LABELS[rc.format] ?? rc.format}
          <span style="font-size:11px;color:${C.gray};font-weight:normal;margin-left:8px;">${course?.name ?? rc.courseId}${rc.date ? ` · ${fmtDate(rc.date)}` : ''}</span>
        </div>
        ${(regularMatches.length || blindMatches.length) ? `<table width="100%" cellpadding="0" cellspacing="0">${matchRows}</table>` : ''}
        ${ptsRow ? `<div style="margin-top:6px;">${ptsRow}</div>` : ''}
        ${ctpSnippet ? `<div style="margin-top:4px;">${ctpSnippet}</div>` : ''}
      </div>
    `
  }).join('<div style="border-top:1px solid #e5e7eb;margin:8px 0;"></div>')

  // ── CTP summary ───────────────────────────────────────────────────────────
  const allCtp = ctpEntries.filter(e => e.year === year && e.winnerName)
  const ctpSection = allCtp.length ? `
    ${sectionHeader('Par 3 CTP Winners')}
    <table width="100%" cellpadding="0" cellspacing="0">
      ${allCtp.sort((a,b) => a.round - b.round || a.hole - b.hole).map(e => `<tr>
        <td style="font-size:12px;padding:5px 0;color:${C.gray};border-bottom:1px solid #f5f5f5;">R${e.round} · Hole ${e.hole}${e.yardage ? ` (${e.yardage} yds)` : ''}</td>
        <td style="font-size:12px;padding:5px 0;font-weight:bold;color:${C.dark};border-bottom:1px solid #f5f5f5;text-align:right;">${e.winnerName}${e.donatedToHio ? ' <span style="color:#6b7280;font-weight:normal;">(→ HIO pot)</span>' : ''}</td>
      </tr>`).join('')}
    </table>
  ` : ''

  // ── End-of-year awards ────────────────────────────────────────────────────
  const sandbagger = sandbaggerPlayerId ? teams.flatMap(t => t.players).find(p => p.id === sandbaggerPlayerId) : null
  const toilet = toiletAwardPlayerId ? teams.flatMap(t => t.players).find(p => p.id === toiletAwardPlayerId) : null
  const awardsSection = (sandbagger || toilet) ? `
    ${sectionHeader('End-of-Year Awards')}
    <table width="100%" cellpadding="0" cellspacing="0">
      ${sandbagger ? `<tr>
        <td style="font-size:13px;padding:8px 0;border-bottom:1px solid #f5f5f5;">🏅 <strong>Sandbagger Award</strong></td>
        <td style="font-size:13px;padding:8px 0;border-bottom:1px solid #f5f5f5;text-align:right;font-weight:bold;color:${C.dark};">${sandbagger.name}</td>
      </tr>` : ''}
      ${toilet ? `<tr>
        <td style="font-size:13px;padding:8px 0;">🚽 <strong>Toilet Award</strong></td>
        <td style="font-size:13px;padding:8px 0;text-align:right;font-weight:bold;color:${C.dark};">${toilet.name}</td>
      </tr>` : ''}
    </table>
  ` : ''

  // ── HIO pot — mirrors HoleInOne page: all unclaimed paid donations + CTP→HIO ──
  const ctpHioTotal =
    ctpHioHistory.reduce((s, h) => s + h.amount, 0) +
    ctpEntries.filter(e => e.donatedToHio).reduce((s, e) => s + (e.hioDonationAmount ?? 0), 0)
  const paidUnclaimed = hioDonations.filter(d => d.paid && !d.claimedByHioId)
  const potTotal = paidUnclaimed.reduce((s, d) => s + d.amount, 0) + ctpHioTotal
  const hioSection = potTotal > 0 ? `
    ${sectionHeader('Hole-in-One Pot')}
    <p style="font-size:13px;color:${C.gray};margin:0 0 4px;">
      Current pot: <strong style="font-size:16px;color:${C.dark};">$${potTotal}</strong>
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
      <tr>
        <td style="font-size:12px;color:${C.gray};padding:3px 0;">Player donations (all years, unclaimed)</td>
        <td style="font-size:12px;color:${C.dark};text-align:right;padding:3px 0;">$${paidUnclaimed.reduce((s, d) => s + d.amount, 0)}</td>
      </tr>
      ${ctpHioTotal > 0 ? `<tr>
        <td style="font-size:12px;color:${C.gray};padding:3px 0;">CTP → HIO transfers</td>
        <td style="font-size:12px;color:${C.dark};text-align:right;padding:3px 0;">$${ctpHioTotal}</td>
      </tr>` : ''}
    </table>
    <p style="font-size:11px;color:${C.gray};margin:6px 0 0;">Rolls over to next year if unclaimed.</p>
  ` : ''

  const body = `
    ${championSection}
    ${standingsSection}
    ${sectionHeader('Round-by-Round Recap')}
    ${roundSections}
    ${ctpSection}
    ${awardsSection}
    ${hioSection}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:${C.gray};">
      See you next year. 🏌️ &nbsp;·&nbsp; <a href="https://juggerknockerinvitational.com" style="color:${C.green};">juggerknockerinvitational.com</a>
    </div>
  `

  const subject = `[Jugger ${year}] Tournament Summary — ${champion?.name ?? 'Final Results'} Wins!`
  return { subject, html: shell(year, body) }
}
