import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function storeId(): string | null {
  return process.env.ANTHROPIC_MEMORY_STORE_ID ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = () => (anthropic.beta as any).memoryStores

export async function readMemory(path: string): Promise<string | null> {
  const id = storeId()
  if (!id) return null
  try {
    const page = await store().memories.list(id, { path_prefix: path })
    const mem = page.data?.find((m: { path: string }) => m.path === path)
    if (!mem) return null
    const full = await store().memories.retrieve(mem.id, { memory_store_id: id })
    return full.content ?? null
  } catch (err) {
    console.error('[memory] read failed:', err)
    return null
  }
}

export async function writeMemory(path: string, content: string): Promise<void> {
  const id = storeId()
  if (!id) return
  try {
    const page = await store().memories.list(id, { path_prefix: path })
    const existing = page.data?.find((m: { path: string }) => m.path === path)
    if (existing) {
      await store().memories.update(existing.id, { memory_store_id: id, content })
    } else {
      await store().memories.create(id, { path, content })
    }
  } catch (err) {
    console.error('[memory] write failed:', err)
  }
}

export async function createMemoryStore(): Promise<string> {
  const created = await store().create({
    name: 'Bea Household Memory',
    description: 'Per-member context briefs and session history for the Bea family companion.',
  })
  return created.id as string
}
