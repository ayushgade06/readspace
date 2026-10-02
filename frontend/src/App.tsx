import { useCallback, useEffect, useRef, useState } from 'react'
import type { Activity, Seat, Stats } from './api'
import { changeSeat, getActivity, getSeats, getStats } from './api'
import { ActivityList } from './components/ActivityList'
import { FloorPlan } from './components/FloorPlan'
import { SummaryBar } from './components/SummaryBar'

// Other people use the hall at the same time, so the page re-reads the
// data from the API at this interval.
const REFRESH_INTERVAL_MS = 5000

interface Notice {
  kind: 'success' | 'error'
  text: string
}

function App() {
  const [seats, setSeats] = useState<Seat[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<Activity[]>([])
  const [loaded, setLoaded] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [pendingSeatId, setPendingSeatId] = useState<number | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeTimer = useRef<number | undefined>(undefined)

  const refresh = useCallback(async () => {
    try {
      const [seatList, seatStats, recent] = await Promise.all([getSeats(), getStats(), getActivity()])
      setSeats(seatList)
      setStats(seatStats)
      setActivity(recent)
      setLoaded(true)
      setConnectionError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setConnectionError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  const showNotice = (next: Notice) => {
    setNotice(next)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000)
  }

  const handleSeatClick = async (seat: Seat) => {
    const action = seat.status === 'available' ? 'occupy' : 'release'
    setPendingSeatId(seat.id)
    try {
      const result = await changeSeat(seat.id, action)
      showNotice({ kind: 'success', text: result.message })
    } catch (err) {
      showNotice({ kind: 'error', text: (err as Error).message })
    } finally {
      // Re-read everything so the map, the counts and the activity list
      // always agree with the database, also after a failed request.
      await refresh()
      setPendingSeatId(null)
    }
  }

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div>
            <h1>PICT Reading Hall</h1>
            <p className="header-subtitle">ReadSpace · Pune Institute of Computer Technology</p>
          </div>
          <div className={`connection ${connectionError ? 'connection-down' : ''}`} role="status">
            <span className="connection-dot" aria-hidden="true" />
            {connectionError
              ? 'Not connected'
              : lastUpdated
                ? `Live · updated ${lastUpdated.toLocaleTimeString('en-IN', { hour12: false })}`
                : 'Connecting'}
          </div>
        </div>
      </header>

      <main className="page">
        {connectionError && (
          <div className="banner banner-error" role="alert">
            <span>
              {connectionError}
              {loaded && ' The seat map below may be out of date.'}
            </span>
            <button type="button" className="banner-button" onClick={refresh}>
              Retry
            </button>
          </div>
        )}

        <h2 className="section-title">Live Occupancy</h2>
        <SummaryBar stats={stats} />

        <div className="columns">
          <section className="panel">
            <div className="panel-header">
              <h2>Reading Hall Floor Plan</h2>
              <ul className="legend" aria-label="Legend">
                <li>
                  <span className="legend-swatch legend-available" aria-hidden="true" />
                  Available
                </li>
                <li>
                  <span className="legend-swatch legend-occupied" aria-hidden="true" />
                  Occupied
                </li>
              </ul>
            </div>

            <div className={`notice ${notice ? `notice-${notice.kind}` : ''}`} aria-live="polite">
              {notice ? notice.text : 'Click an available seat to occupy it, or an occupied seat to release it.'}
            </div>

            {loaded ? (
              <FloorPlan seats={seats} pendingSeatId={pendingSeatId} onSeatClick={handleSeatClick} />
            ) : (
              <p className="empty">{connectionError ? 'The seat map could not be loaded.' : 'Loading seats…'}</p>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Recent Activity</h2>
            </div>
            {loaded ? (
              <ActivityList activity={activity} />
            ) : (
              <p className="empty">{connectionError ? 'Activity could not be loaded.' : 'Loading activity…'}</p>
            )}
          </section>
        </div>
      </main>
    </>
  )
}

export default App
