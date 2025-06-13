import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../UserContext'

export default function Login() {
  const navigate = useNavigate()
  const { setUser } = useContext(UserContext)

  function handleSubmit(e) {
    e.preventDefault()
    setUser({ name: 'test user' })
    navigate('/dashboard')
  }

  return (
    <div className="form-container">
      <h2>Log In</h2>
      <form onSubmit={handleSubmit} className="form">
        <div>
          <input type="email" placeholder="Email" required />
        </div>
        <div>
          <input type="password" placeholder="Password" required />
        </div>
        <button className="signup-btn" type="submit">Log In</button>
      </form>
    </div>
  )
}
