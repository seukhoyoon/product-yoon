import { jest } from '@jest/globals'

// fs/promises 모킹
const mockReadFile = jest.fn()
const mockWriteFile = jest.fn()
const mockMkdir = jest.fn()

jest.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
}))

// 매 테스트 전 모킹 초기화
beforeEach(() => {
  jest.clearAllMocks()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
})

// 모듈을 모킹 후 import
let addToWaitlist: (email: string) => Promise<{ success: boolean; duplicate: boolean }>
let getWaitlist: () => Promise<string[]>

beforeAll(async () => {
  const mod = await import('@/lib/waitlist')
  addToWaitlist = mod.addToWaitlist
  getWaitlist = mod.getWaitlist
})

describe('addToWaitlist', () => {
  it('빈 waitlist에 이메일을 추가한다', async () => {
    mockReadFile.mockRejectedValue({ code: 'ENOENT' })

    const result = await addToWaitlist('test@example.com')

    expect(result).toEqual({ success: true, duplicate: false })
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('waitlist.json'),
      JSON.stringify(['test@example.com'], null, 2),
      'utf-8'
    )
  })

  it('기존 목록에 이메일을 추가한다', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(['existing@example.com']))

    const result = await addToWaitlist('new@example.com')

    expect(result).toEqual({ success: true, duplicate: false })
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('waitlist.json'),
      JSON.stringify(['existing@example.com', 'new@example.com'], null, 2),
      'utf-8'
    )
  })

  it('중복 이메일은 추가하지 않고 duplicate: true를 반환한다', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(['dupe@example.com']))

    const result = await addToWaitlist('dupe@example.com')

    expect(result).toEqual({ success: false, duplicate: true })
    expect(mockWriteFile).not.toHaveBeenCalled()
  })
})

describe('getWaitlist', () => {
  it('저장된 이메일 목록을 반환한다', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(['a@b.com', 'c@d.com']))

    const result = await getWaitlist()

    expect(result).toEqual(['a@b.com', 'c@d.com'])
  })

  it('파일이 없으면 빈 배열을 반환한다', async () => {
    mockReadFile.mockRejectedValue({ code: 'ENOENT' })

    const result = await getWaitlist()

    expect(result).toEqual([])
  })
})
