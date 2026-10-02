import type { Seat } from '../api'
import { formatSeatNumber } from '../api'

interface Props {
  seats: Seat[]
  pendingSeatId: number | null
  onSeatClick: (seat: Seat) => void
}

// Tables per row of the hall: two on each side of the central aisle.
const TABLES_PER_ROW = 4
// Grid columns used by the tables. Column 3 is the aisle.
const TABLE_COLUMNS = [1, 2, 4, 5]

// Groups seats by table, keeping the order in which tables first appear.
function groupBySection(seats: Seat[]): [string, Seat[]][] {
  const sections = new Map<string, Seat[]>()
  for (const seat of seats) {
    const list = sections.get(seat.section) ?? []
    list.push(seat)
    sections.set(seat.section, list)
  }
  return [...sections.entries()]
}

export function FloorPlan({ seats, pendingSeatId, onSeatClick }: Props) {
  const tables = groupBySection(seats)
  const rowCount = Math.ceil(tables.length / TABLES_PER_ROW)

  const renderSeat = (seat: Seat, side: 'top' | 'bottom') => {
    const occupied = seat.status === 'occupied'
    const number = formatSeatNumber(seat.seatNumber)
    return (
      <button
        key={seat.id}
        type="button"
        className={`seat seat-${side} ${occupied ? 'seat-occupied' : 'seat-available'}`}
        disabled={pendingSeatId !== null}
        aria-busy={pendingSeatId === seat.id}
        aria-label={`Seat ${number}, ${seat.section}, ${occupied ? 'occupied' : 'available'}`}
        title={occupied ? `Seat ${number} is occupied. Click to release.` : `Seat ${number} is available. Click to occupy.`}
        onClick={() => onSeatClick(seat)}
      >
        <span className="seat-number">{number}</span>
        <span className="seat-state">{occupied ? 'In use' : 'Free'}</span>
      </button>
    )
  }

  return (
    <div className="hall">
      <div className="hall-entry">Entry</div>
      <div className="hall-grid">
        <div className="hall-aisle" style={{ gridRow: `1 / span ${rowCount}` }}>
          <span>Aisle</span>
        </div>
        {tables.map(([section, tableSeats], index) => {
          const half = Math.ceil(tableSeats.length / 2)
          return (
            <div
              key={section}
              className="table-block"
              style={{
                gridColumn: TABLE_COLUMNS[index % TABLES_PER_ROW],
                gridRow: Math.floor(index / TABLES_PER_ROW) + 1,
              }}
            >
              <div className="seat-row">{tableSeats.slice(0, half).map((s) => renderSeat(s, 'top'))}</div>
              <div className="table-surface">{section}</div>
              <div className="seat-row">{tableSeats.slice(half).map((s) => renderSeat(s, 'bottom'))}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
