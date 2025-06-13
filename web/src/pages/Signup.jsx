import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../UserContext'

export default function Signup() {
  const navigate = useNavigate()
  const { setUser } = useContext(UserContext)

  function handleSubmit(e) {
    e.preventDefault()
    setUser({ name: 'test user' })
    navigate('/dashboard')
  }

  return (
    <div>
      <h2>Sign Up</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name: <input type="text" required /></label>
        </div>
        <div>
          <label>Email: <input type="email" required /></label>
        </div>
        <div>
          <label>Password: <input type="password" required /></label>
        </div>
        <button type="submit">Sign Up</button>
      </form>
    </div>
  )
}
