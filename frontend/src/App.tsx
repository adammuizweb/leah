import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import AppShell from './pages/AppShell'
import Dashboard from './pages/Dashboard'
import Tickets from './pages/Tickets'
import Assets from './pages/Assets'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/assets" element={<Assets />} />
      </Route>
    </Routes>
  )
}

export default App
