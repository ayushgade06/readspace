export type SeatStatus = 'available' | 'occupied'

export interface Seat {
  id: number
  seatNumber: number
  section: string
  status: SeatStatus
  updatedAt: string
}

export interface Stats {
  total: number
  occupied: number
  available: number
  occupancyPercentage: number
}

export interface Activity {
  id: number
  seatId: number
  seatNumber: number
  section: string
  action: 'occupy' | 'release'
  createdAt: string
}

const BACKEND_UNAVAILABLE = 'Backend unavailable. Check that the server is running.'

async function request<T>(path: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { method })
  } catch {
    throw new Error(BACKEND_UNAVAILABLE)
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    // The API always answers errors with { error: "..." }. If there is no
    // such body, the response came from a proxy and the API itself is down.
    throw new Error(body?.error ?? BACKEND_UNAVAILABLE)
  }
  return body as T
}

export const getSeats = () => request<Seat[]>('/api/seats')
export const getStats = () => request<Stats>('/api/stats')
export const getActivity = () => request<Activity[]>('/api/activity')

export const changeSeat = (id: number, action: 'occupy' | 'release') =>
  request<{ message: string; seat: Seat }>(`/api/seats/${id}/${action}`, 'POST')

export const formatSeatNumber = (n: number) => String(n).padStart(2, '0')

/**
 * Converts an ISO 8601 timestamp into a short relative string, e.g.
 * "just now", "3 minutes ago", "2 hours ago".
 */
export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 60) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}
