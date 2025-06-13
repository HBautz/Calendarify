import { useContext, useState } from 'react'
import { UserContext } from '../UserContext'

function CalendarSelector({ onDateSelected }) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })
  return (
    <div className="calendar-selector">
      {days.map(d => (
        <div
          key={d.toISOString()}
          className="calendar-day"
          onClick={() => onDateSelected(d)}
        >
          {d.getDate()}-{d.getMonth()+1}
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useContext(UserContext)
  const [selectedDate, setSelectedDate] = useState(null)
  const [time, setTime] = useState('')

  const currentUser = user || { name: 'test user' }

  return (
    <div>
      <h2>Welcome, {currentUser.name}</h2>
      <CalendarSelector onDateSelected={setSelectedDate} />
      {selectedDate && (
        <div className="appointment-form">
          <h3>{selectedDate.toDateString()}</h3>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
          <button style={{ marginLeft: '1em' }} onClick={() => {setSelectedDate(null); setTime('')}}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
