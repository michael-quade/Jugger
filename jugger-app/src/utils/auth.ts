export const DEFAULT_PASSWORD = '123456789!'

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters required.'
  if (!/\d/.test(pw)) return 'Must include at least one number.'
  if (!/[^a-zA-Z0-9]/.test(pw)) return 'Must include at least one special character.'
  return null
}

export function generateUsername(name: string, existingUsernames: string[]): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = (parts[0]?.[0] ?? 'x').toLowerCase()
  const last  = (parts[parts.length - 1] ?? parts[0] ?? 'player')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const base  = first + last
  if (!existingUsernames.map(u => u.toLowerCase()).includes(base)) return base
  let i = 2
  while (existingUsernames.map(u => u.toLowerCase()).includes(`${base}${i}`)) i++
  return `${base}${i}`
}
