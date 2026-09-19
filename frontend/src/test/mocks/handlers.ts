import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../../shared/config/env'

export const handlers = [
  http.get(`${API_BASE_URL}/ping`, () => HttpResponse.json({ pong: true })),
]
