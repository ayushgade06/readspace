import type { Activity } from '../api'
import { formatSeatNumber } from '../api'

interface Props {
  activity: Activity[]
}

const timeFormat = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export function ActivityList({ activity }: Props) {
  if (activity.length === 0) {
    return <p className="empty">No activity yet. Click a seat to occupy it.</p>
  }

  return (
    <ol className="activity">
      {activity.map((item) => (
        <li key={item.id} className="activity-item">
          <span className={`activity-tag activity-tag-${item.action}`}>
            {item.action === 'occupy' ? 'Occupied' : 'Released'}
          </span>
          <span className="activity-seat">
            Seat {formatSeatNumber(item.seatNumber)}
            <span className="activity-section">{item.section}</span>
          </span>
          <time className="activity-time" dateTime={item.createdAt}>
            {timeFormat.format(new Date(item.createdAt))}
          </time>
        </li>
      ))}
    </ol>
  )
}
