import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="text-center space-y-4">
      <h1>Easy scheduling ahead</h1>
      <p>Calendarify is the modern scheduling platform that makes scheduling easy.</p>
      <div>
        <Link to="/signup" className="signup-btn">Get Started</Link>
      </div>
    </div>
  )
}
