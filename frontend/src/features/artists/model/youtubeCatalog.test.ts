import { describe, expect, it } from 'vitest'
import { youtubeVideoId } from './youtubeCatalog'

describe('youtube links', () => {
  it.each([
    ['https://www.youtube.com/watch?v=XDlxJS9bK88', 'XDlxJS9bK88'],
    ['https://youtu.be/XDlxJS9bK88?t=18', 'XDlxJS9bK88'],
    ['https://www.youtube.com/embed/XDlxJS9bK88', 'XDlxJS9bK88'],
    ['https://youtube.com/live/XDlxJS9bK88', 'XDlxJS9bK88'],
    ['https://youtube.com/shorts/XDlxJS9bK88', 'XDlxJS9bK88'],
  ])('extracts a video id from %s', (url, expected) => {
    expect(youtubeVideoId(url)).toBe(expected)
  })
})
