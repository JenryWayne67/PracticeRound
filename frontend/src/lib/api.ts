// One place for every backend call. Usage: api.get<Item[]>('/items'), api.post('/items', {...})

const BASE = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string | null) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const isRawBody = init.body instanceof FormData || init.body instanceof URLSearchParams
  if (init.body && !isRawBody) headers.set('Content-Type', 'application/json')

  const res = await fetch(BASE + path, { ...init, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = body?.detail
    // FastAPI validation errors come back as a list of {msg}.
    const message = Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : detail
    throw new ApiError(res.status, message || res.statusText)
  }
  return res
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const raw = body instanceof FormData || body instanceof URLSearchParams
  const res = await send(path, {
    method,
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  })
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ filename: string; url: string; size: number }>('POST', '/uploads', form)
  },
}

/** POST and read a streamed text response chunk by chunk (used by the AI chat). */
export async function streamText(path: string, body: unknown, onChunk: (text: string) => void) {
  const res = await send(path, { method: 'POST', body: JSON.stringify(body) })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
}

/** Realtime room: const ws = openRoom('lobby', (msg) => ...); ws.send(JSON.stringify({...})) */
export function openRoom(room: string, onMessage: (data: unknown) => void): WebSocket {
  const origin = BASE.startsWith('http') ? BASE : location.origin + BASE
  const ws = new WebSocket(`${origin.replace(/^http/, 'ws')}/ws/${encodeURIComponent(room)}`)
  ws.onmessage = (event) => onMessage(JSON.parse(event.data))
  return ws
}
