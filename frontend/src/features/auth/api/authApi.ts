import { apiRequest } from '../../../shared/api/client'
import type { SessionTokens } from '../model/sessionStore'

export interface LoginInput {
  email: string
  password: string
  device: {
    fingerprint: string
    kind: 'web'
    name: string
    app_version: string
  }
}

export interface RegisterInput {
  email: string
  password: string
  display_name: string
}

export interface RegisteredAccount {
  public_id: string
  email: string
}

export interface UpdateProfileInput {
  display_name?: string
  settings?: Record<string, unknown>
}

export interface Profile {
  public_id: string
  email: string
  email_verified: boolean
  date_joined: string
  plan: string
  profile: {
    display_name: string
    avatar_key: string | null
    country: string
    birth_date: string | null
    language: string
    preferred_quality: string
    settings: Record<string, unknown>
  } | null
}

export function login(input: LoginInput) {
  return apiRequest<SessionTokens>('auth/token', {
    method: 'POST',
    body: input,
    auth: false,
  })
}

export function register(input: RegisterInput) {
  return apiRequest<RegisteredAccount>('auth/register', {
    method: 'POST',
    body: input,
    auth: false,
  })
}

export function confirmEmail(token: string) {
  return apiRequest<void>('auth/email/verify/confirm', {
    method: 'POST',
    body: { token },
    auth: false,
  })
}

export function getProfile() {
  return apiRequest<Profile>('me')
}

export function updateProfile(input: UpdateProfileInput) {
  return apiRequest<Profile>('me', {
    method: 'PATCH',
    body: input,
  })
}
