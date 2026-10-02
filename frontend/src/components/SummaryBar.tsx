import type { Stats } from '../api'

interface Props {
  stats: Stats | null
}

export function SummaryBar({ stats }: Props) {
  const value = (n: number | undefined) => (n === undefined ? '–' : n)
  const percentage = stats ? Math.round(stats.occupancyPercentage) : 0

  return (
    <section className="summary" aria-label="Live Occupancy">
      <div className="summary-item">
        <span className="summary-label">Total Seats</span>
        <span className="summary-value">{value(stats?.total)}</span>
      </div>
      <div className="summary-item">
        <span className="summary-label">Occupied Seats</span>
        <span className="summary-value">{value(stats?.occupied)}</span>
      </div>
      <div className="summary-item">
        <span className="summary-label">Available Seats</span>
        <span className="summary-value summary-value-available">{value(stats?.available)}</span>
      </div>
      <div className="summary-item summary-item-wide">
        <span className="summary-label">Occupancy</span>
        <span className="summary-value">{stats ? `${percentage}%` : '–'}</span>
        <div
          className="occupancy-bar"
          role="progressbar"
          aria-label="Occupancy"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <div className="occupancy-bar-fill" style={{ width: `${percentage}%` }} />
        </div>
      </div>
    </section>
  )
}
