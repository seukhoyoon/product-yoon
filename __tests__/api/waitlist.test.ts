/**
 * @jest-environment node
 */
// __tests__/api/waitlist.test.ts
import { jest } from '@jest/globals'
import { NextRequest } from 'next/server'

const mockAddToWaitlist = jest.fn()

jest.mock('@/lib/waitlist', () => ({
  addToWaitlist: mockAddToWaitlist,
}))

let POST: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  const mod = await import('@/app/api/waitlist/route')
  POST = mod.POST
})

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.RESEND_API_KEY
})

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/waitlist', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/waitlist', () => {
  it('유효한 이메일을 성공적으로 등록한다', async () => {
    mockAddToWaitlist.mockResolvedValue({ success: true, duplicate: false })

    const res = await POST(makeRequest({ email: 'test@example.com' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true, duplicate: false })
    expect(mockAddToWaitlist).toHaveBeenCalledWith('test@example.com')
  })

  it('중복 이메일은 200으로 응답하고 duplicate: true를 반환한다', async () => {
    mockAddToWaitlist.mockResolvedValue({ success: false, duplicate: true })

    const res = await POST(makeRequest({ email: 'dupe@example.com' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: false, duplicate: true })
  })

  it('이메일 없으면 400을 반환한다', async () => {
    const res = await POST(makeRequest({}))

    expect(res.status).toBe(400)
    expect(mockAddToWaitlist).not.toHaveBeenCalled()
  })

  it('잘못된 이메일 형식이면 400을 반환한다', async () => {
    const res = await POST(makeRequest({ email: 'notanemail' }))

    expect(res.status).toBe(400)
    expect(mockAddToWaitlist).not.toHaveBeenCalled()
  })
})
