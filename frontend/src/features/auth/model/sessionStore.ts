import { create } from 'zustand'

export interface SessionTokens {
  access: string
  refresh?: string
  access_expires_in?: number
}

interface SessionState {
  accessToken: string | null
  refreshToken: string | null
  setTokens: (tokens: SessionTokens) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  refreshToken: null,
  setTokens: (tokens) =>
    set((state) => ({
      accessToken: tokens.access,
      refreshToken: tokens.refresh ?? state.refreshToken,
    })),
  clearSession: () => set({ accessToken: null, refreshToken: null }),
}))
