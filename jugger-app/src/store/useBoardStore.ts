import { create } from 'zustand'

interface BoardState {
  unreadCount: number
  setUnreadCount: (n: number) => void
}

export const useBoardStore = create<BoardState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
}))
