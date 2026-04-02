import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'

const WAITLIST_PATH = path.join(process.cwd(), 'data', 'waitlist.json')

async function readEmails(): Promise<string[]> {
  try {
    const content = await readFile(WAITLIST_PATH, 'utf-8')
    return JSON.parse(content) as string[]
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

export async function addToWaitlist(
  email: string
): Promise<{ success: boolean; duplicate: boolean }> {
  const emails = await readEmails()

  const normalizedEmail = email.toLowerCase().trim()
  if (emails.map((e) => e.toLowerCase()).includes(normalizedEmail)) {
    return { success: false, duplicate: true }
  }

  await mkdir(path.dirname(WAITLIST_PATH), { recursive: true })
  await writeFile(
    WAITLIST_PATH,
    JSON.stringify([...emails, normalizedEmail], null, 2),
    'utf-8'
  )

  return { success: true, duplicate: false }
}

export async function getWaitlist(): Promise<string[]> {
  return readEmails()
}
