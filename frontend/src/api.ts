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
