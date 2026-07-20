const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const errorMessage = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as { detail?: string }
    return body.detail || fallback
  } catch {
    return fallback
  }
}

const request = async (path: string, init: RequestInit, fallback: string) => {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init)
  } catch {
    throw new ApiError('Could not reach the CV Maker service. Check your connection and try again.', 0)
  }
  if (!response.ok) throw new ApiError(await errorMessage(response, fallback), response.status)
  return response
}

export const apiJson = async <T>(path: string, init: RequestInit = {}, fallback = 'The request failed.') => {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await request(path, { ...init, headers }, fallback)
  return (await response.json()) as T
}

export const apiBlob = async (path: string, init: RequestInit = {}, fallback = 'The download failed.') => {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await request(path, { ...init, headers }, fallback)
  return response.blob()
}

export const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback
