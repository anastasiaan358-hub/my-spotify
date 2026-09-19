import { create } from 'zustand'

export interface PlayerTrack {
  id: string
  title: string
  artist: string
  sourceLabel?: string
  coverUrl?: string
  streamUrl?: string
  mediaType?: 'midi' | 'audio'
  durationMs?: number
}

interface PlayerState {
  currentTrack: PlayerTrack | null
  isPlaying: boolean
  volume: number
  setTrack: (track: PlayerTrack) => void
  togglePlayback: () => void
  setPlaying: (isPlaying: boolean) => void
  setVolume: (volume: number) => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTrack: null,
  isPlaying: false,
  volume: 0.75,
  setTrack: (track) => set({ currentTrack: track, isPlaying: Boolean(track.streamUrl) }),
  togglePlayback: () =>
    set((state) => ({ isPlaying: state.currentTrack?.streamUrl ? !state.isPlaying : false })),
  setPlaying: (isPlaying) => set((state) => ({ isPlaying: Boolean(state.currentTrack?.streamUrl) && isPlaying })),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
}))
