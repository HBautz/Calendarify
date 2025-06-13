import { Link } from 'react-router-dom'
import './App.css'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#111714] text-white font-sans">
      <header className="bg-[#111f1c] py-4 px-6 md:px-12">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center text-2xl font-bold">
            Calendarify
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link className="text-[#A3B3AF] hover:text-white" to="/product">Product</Link>
            <Link className="text-[#A3B3AF] hover:text-white" to="/pricing">Pricing</Link>
          </nav>
          <div className="flex items-center space-x-4">
            <Link to="/login" className="text-[#A3B3AF] hover:text-white">Log In</Link>
            <Link to="/signup" className="bg-[#34D399] text-[#1A2E29] px-4 py-2 rounded-lg hover:bg-[#2C4A43]">Sign Up</Link>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
      <footer className="py-8 text-center text-sm text-[#A3B3AF]">
        <p>This is a demo application and is not intended for actual use.</p>
      </footer>
    </div>
  )
}
