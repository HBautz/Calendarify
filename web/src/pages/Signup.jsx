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
    <div className="space-y-6 px-4 sm:px-40 flex flex-col items-center flex-1 justify-center py-5">
      <div className="flex flex-col w-full max-w-[400px] border border-[#3d5245] rounded-2xl p-8 mx-auto bg-[#1c2420]">
        <h2 className="text-white tracking-light text-[28px] font-bold leading-tight text-center pb-3 pt-5">Sign up</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input className="form-input w-full rounded-xl text-white bg-[#29382f] h-14 placeholder:text-[#9eb7a8] p-4" type="text" placeholder="Full Name" required />
          </div>
          <div>
            <input className="form-input w-full rounded-xl text-white bg-[#29382f] h-14 placeholder:text-[#9eb7a8] p-4" type="email" placeholder="Email" required />
          </div>
          <div>
            <input className="form-input w-full rounded-xl text-white bg-[#29382f] h-14 placeholder:text-[#9eb7a8] p-4" type="password" placeholder="Password" required />
          </div>
          <div>
            <input className="form-input w-full rounded-xl text-white bg-[#29382f] h-14 placeholder:text-[#9eb7a8] p-4" type="password" placeholder="Confirm Password" required />
          </div>
          <button className="bg-[#38e07b] text-[#111714] h-10 rounded-full px-4 w-full text-sm font-bold" type="submit">Sign up</button>
        </form>
      </div>
      <p className="text-[#9eb7a8] text-sm text-center">By signing up, you agree to our Terms of Service and Privacy Policy.</p>
      <p className="text-[#9eb7a8] text-sm text-center">This is a demo application and is not intended for actual use. All functionality is for demonstration purposes only.</p>
    </div>
  )
}
