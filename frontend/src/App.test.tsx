import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { AppProviders } from './app/providers/AppProviders'

describe('App', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))

  it('показывает главную страницу', () => {
    render(<AppProviders><App /></AppProviders>)

    expect(screen.getByRole('heading', { name: 'МУЗЫКА БЕЗ ГРАНИЦ.' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument()
  })

  it('открывает регистрацию из верхней иконки аккаунта', async () => {
    const user = userEvent.setup()
    render(<AppProviders><App /></AppProviders>)

    await user.click(screen.getByRole('link', { name: 'Создать аккаунт' }))

    expect(screen.getByRole('heading', { name: 'Создайте аккаунт' })).toBeInTheDocument()
    expect(screen.getByLabelText('Электронная почта')).toBeInTheDocument()
    expect(screen.getByLabelText('Ник')).toBeInTheDocument()
    expect(screen.getByLabelText('Придумайте пароль')).toBeInTheDocument()
  })

  it('открывает 20 карточек композиторов после начала сессии', async () => {
    const user = userEvent.setup()
    render(<AppProviders><App /></AppProviders>)

    await user.click(screen.getByRole('link', { name: /начать сессию/i }))

    expect(screen.getByRole('heading', { name: /выберите композитора/i })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(20)
  })

  it('проходит от композитора через сборник к партитуре и биографии', async () => {
    const user = userEvent.setup()
    render(<AppProviders><App /></AppProviders>)

    await user.click(screen.getByRole('link', { name: /начать сессию/i }))
    await user.click(screen.getByRole('link', { name: 'Открыть композитора Грегорио Аллегри' }))

    expect(screen.getByRole('heading', { name: 'Грегорио Аллегри', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /открыть альбом/i })).toHaveLength(1)

    await user.click(screen.getByRole('link', { name: 'Открыть альбом Miserere' }))
    expect(screen.getAllByRole('link', { name: /открыть трек/i })).toHaveLength(1)

    await user.click(screen.getByRole('link', { name: 'Открыть трек Miserere mei, Deus' }))
    expect(screen.getByRole('tabpanel', { name: 'Ноты' })).toBeInTheDocument()
    expect(screen.getByTitle('Партитура Miserere mei, Deus')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Биография композитора' }))
    expect(screen.getByRole('tabpanel', { name: 'Биография композитора' })).toBeInTheDocument()
  })

  it('открывает ноты напрямую из карточки альбома', async () => {
    const user = userEvent.setup()
    render(<AppProviders><App /></AppProviders>)

    await user.click(screen.getByRole('link', { name: /начать сессию/i }))
    await user.click(screen.getByRole('link', { name: 'Открыть композитора Грегорио Аллегри' }))
    await user.click(screen.getByRole('link', { name: 'Открыть ноты альбома Miserere' }))

    expect(screen.getByRole('tabpanel', { name: 'Ноты' })).toBeInTheDocument()
  })

  it('показывает исследование музыкальной цитаты с цепочкой и литературой', () => {
    window.history.replaceState({}, '', '/citations/tallis-salve-intemerata')
    render(<AppProviders><App /></AppProviders>)

    expect(screen.getByRole('heading', { name: 'Salve intemerata: Tallis → Tallis', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Цепочка материала' })).toBeInTheDocument()
    expect(screen.getByText('Missa Salve intemerata')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Источники и литература' })).toBeInTheDocument()
    expect(screen.getByText('СВЯЗЬ ПОДТВЕРЖДЕНА')).toBeInTheDocument()
  })

  it('открывает отдельную ветку древней музыки', () => {
    window.history.replaceState({}, '', '/ancient-music')
    render(<AppProviders><App /></AppProviders>)

    expect(screen.getByRole('heading', { name: 'ДРЕВНЯЯ МУЗЫКА', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Шумер и Аккад' })).toBeInTheDocument()
    expect(screen.getByText('Гимн храму Кеша')).toBeInTheDocument()
    expect(screen.getByText('Хурритский гимн Никкаль h.6')).toBeInTheDocument()
    expect(screen.getByText('Первый Дельфийский гимн Аполлону')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /В литературе: открыть историю текста/i })).toHaveLength(20)
  })

  it('открывает полную литературную историю музыкального памятника', () => {
    window.history.replaceState({}, '', '/literature/great-hymn-aten')
    render(<AppProviders><App /></AppProviders>)

    expect(screen.getByRole('heading', { name: 'Великий гимн Атону', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Как текст связан с музыкой' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'История текста' })).toBeInTheDocument()
    expect(screen.getByText(/тринадцати колонках/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Текст и исследования' })).toBeInTheDocument()
  })

  it('переходит от древнего произведения к исследованию поздней цитаты', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/ancient-music')
    render(<AppProviders><App /></AppProviders>)

    expect(screen.getAllByRole('link', { name: /открыть исследование/i })).toHaveLength(6)
    await user.click(screen.getByRole('link', { name: /Стасим из «Ореста» → Orestes’ Chamber/i }))

    expect(screen.getByRole('heading', { name: 'Стасим из «Ореста» → Orestes’ Chamber', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Orestes’ Chamber')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Что именно перешло' })).toBeInTheDocument()
  })
})
