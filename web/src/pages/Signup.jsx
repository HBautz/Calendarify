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
    <div className="max-w-md mx-auto bg-[#1c2420] rounded-xl p-8">
      <h2 className="text-xl font-bold mb-4 text-center">Sign Up</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input className="w-full p-3 rounded bg-[#29382f]" type="text" placeholder="Name" required />
        </div>
        <div>
          <input className="w-full p-3 rounded bg-[#29382f]" type="email" placeholder="Email" required />
        </div>
        <div>
          <input className="w-full p-3 rounded bg-[#29382f]" type="password" placeholder="Password" required />
        </div>
        <button className="bg-[#34D399] text-[#1A2E29] w-full py-2 rounded-lg hover:bg-[#2C4A43]" type="submit">Sign Up</button>
      </form>
    </div>
  )
}
