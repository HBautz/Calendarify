import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Product from './pages/Product'
import Pricing from './pages/Pricing'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import { UserProvider } from './UserContext'
import Layout from './Layout'
import './App.css'

export default function App() {
  return (
    <UserProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product" element={<Product />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
          </Routes>
        </Layout>
      </Router>
    </UserProvider>
  )
}
