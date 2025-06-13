import { Link } from 'react-router-dom'
import './App.css'

export default function Layout({ children }) {
  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="brand">Calendarify</Link>
        <nav>
          <Link to="/login">Log In</Link>
          <Link to="/signup" className="signup-btn">Sign Up</Link>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  )
}
