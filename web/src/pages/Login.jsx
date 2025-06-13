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
    <div>
      <h2>Log In</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email: <input type="email" required /></label>
        </div>
        <div>
          <label>Password: <input type="password" required /></label>
        </div>
        <button type="submit">Log In</button>
      </form>
    </div>
  )
}
