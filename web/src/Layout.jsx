import { Link } from 'react-router-dom'
import './App.css'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#111714] text-white font-sans">
      <header className="bg-[#111f1c] py-4 px-6 md:px-12">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center">
            <span className="material-icons-outlined text-3xl text-[#34D399] mr-2">calendar_month</span>
            <h1 className="text-2xl font-bold text-white">Calendarify</h1>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link className="text-[#A3B3AF] hover:text-white" to="/product">Product</Link>
            <a className="text-[#A3B3AF] hover:text-white" href="/static/solutions.html">Solutions</a>
            <a className="text-[#A3B3AF] hover:text-white" href="/static/resources.html">Resources</a>
            <Link className="text-[#A3B3AF] hover:text-white" to="/pricing">Pricing</Link>
          </nav>
          <div className="flex items-center space-x-4">
            <Link to="/login" className="text-[#A3B3AF] hover:text-white">Log in</Link>
            <Link to="/signup" className="bg-[#34D399] text-[#1A2E29] px-4 py-2 rounded-lg hover:bg-[#2C4A43] transition-colors">Sign up</Link>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
      <footer className="py-8 text-center">
        <div className="container mx-auto max-w-[960px]">
          <div className="flex flex-wrap items-center justify-center gap-6 @[480px]:flex-row @[480px]:justify-around">
            <Link className="text-[#A3B3AF] text-base font-normal leading-normal min-w-40" to="/privacy-policy">Privacy Policy</Link>
            <Link className="text-[#A3B3AF] text-base font-normal leading-normal min-w-40" to="/terms">Terms of Service</Link>
            <a className="text-[#A3B3AF] text-base font-normal leading-normal min-w-40" href="/static/contact.html">Contact Us</a>
          </div>
          <p className="text-[#A3B3AF] text-base font-normal leading-normal mt-6">
            This is a demo application and is not intended for actual use. All functionality is for demonstration purposes only.
          </p>
        </div>
      </footer>
    </div>
  )
}
