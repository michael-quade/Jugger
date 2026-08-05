import type { MbThread } from '../types'

function storageKey(username: string) {
  return `jugger-board-read-${username}`
}

export function getReadTimestamps(username: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(storageKey(username)) ?? '{}') }
  catch { return {} }
}

export function markThreadRead(username: string, threadId: string) {
  const data = getReadTimestamps(username)
  data[threadId] = new Date().toISOString()
  localStorage.setItem(storageKey(username), JSON.stringify(data))
}

export function isThreadUnread(thread: MbThread, username: string | null): boolean {
  if (!username) return false
  const timestamps = getReadTimestamps(username)
  const lastRead = timestamps[thread.id]
  if (!lastRead) return thread.reply_count > 0  // never-opened threads only unread if they have replies
  return thread.last_reply_at > lastRead
}

export function countUnreadThreads(threads: MbThread[], username: string | null): number {
  if (!username) return 0
  return threads.filter(t => isThreadUnread(t, username)).length
}
