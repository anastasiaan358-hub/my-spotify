import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSessionStore } from '../features/auth/model/sessionStore'
import { AvatarSetupPage } from '../pages/AvatarSetupPage'
import { AlbumPage } from '../pages/AlbumPage'
import { AncientMusicPage } from '../pages/AncientMusicPage'
import { AncientResearchPage } from '../pages/AncientResearchPage'
import { AncientLiteratureDetailPage } from '../pages/AncientLiteratureDetailPage'
import { ArtistDetailPage } from '../pages/ArtistDetailPage'
import { ArtistsPage } from '../pages/ArtistsPage'
import { ComposerAtlasPage } from '../pages/ComposerAtlasPage'
import { ComposerArchivePage } from '../pages/ComposerArchivePage'
import { HomePage } from '../pages/HomePage'
import { LibraryPage } from '../pages/LibraryPage'
import { LoginPage } from '../pages/LoginPage'
import { MusicHistoryPage } from '../pages/MusicHistoryPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ProfilePage } from '../pages/ProfilePage'
import { QuotationDetailPage } from '../pages/QuotationDetailPage'
import { RegisterPage } from '../pages/RegisterPage'
import { SearchPage } from '../pages/SearchPage'
import { ScorePrintPage } from '../pages/ScorePrintPage'
import { TrackPage } from '../pages/TrackPage'
import { VerifyEmailPage } from '../pages/VerifyEmailPage'
import { AppShell } from '../widgets/app-shell/AppShell'

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useSessionStore((state) => Boolean(state.accessToken))
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])

  return null
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="artists" element={<ArtistsPage />} />
          <Route path="ancient-music" element={<AncientMusicPage />} />
          <Route path="ancient-music/research" element={<AncientResearchPage />} />
          <Route path="music-history" element={<MusicHistoryPage />} />
          <Route path="literature/:workId" element={<AncientLiteratureDetailPage />} />
          <Route path="artists/atlas" element={<ComposerAtlasPage />} />
          <Route path="artists/archive/:composerId" element={<ComposerArchivePage />} />
          <Route path="artists/:artistId" element={<ArtistDetailPage />} />
          <Route path="artists/:artistId/albums/:albumId" element={<AlbumPage />} />
          <Route path="artists/:artistId/albums/:albumId/tracks/:trackId" element={<TrackPage />} />
          <Route path="scores/:catalogId/:workId" element={<ScorePrintPage />} />
          <Route path="citations/:citationId" element={<QuotationDetailPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="library" element={<RequireAuth><LibraryPage /></RequireAuth>} />
          <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        </Route>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="profile/setup" element={<RequireAuth><AvatarSetupPage /></RequireAuth>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
