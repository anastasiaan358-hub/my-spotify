import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../../shared/config/env'

export const handlers = [
  http.get(`${API_BASE_URL}/ping`, () => HttpResponse.json({ pong: true })),
  http.get('*/classical/catalog/history-listening.json', () => HttpResponse.json({
    works: {
      'Неизвестный автор — Хурритский гимн Никкаль h.6': {
        title: 'Хурритский гимн Никкаль h.6',
        artist: 'Неизвестный автор',
        youtubeUrl: 'https://www.youtube.com/watch?v=QpxN2VXPMLc',
        youtubeTitle: 'Hurrian Hymn No. 6',
        channel: 'Test archive',
        durationSeconds: 180,
        playbackStatus: 'playable',
        playableInEmbed: true,
        verifiedAt: '2026-09-20T20:50:00Z',
      },
    },
  })),
  http.get('*/classical/catalog/folk-listening.json', () => HttpResponse.json({
    traditions: {
      'karelian-runosong': {
        title: 'Карельская руническая песня',
        youtubeUrl: 'https://www.youtube.com/watch?v=QpxN2VXPMLc',
        youtubeTitle: 'Karelian runosong',
        channel: 'Test archive',
        durationSeconds: 180,
        playbackStatus: 'playable',
        playableInEmbed: true,
        verifiedAt: '2026-09-20T21:05:00Z',
      },
    },
  })),
]
