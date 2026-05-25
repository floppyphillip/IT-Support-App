import { Routes, Route, Navigate } from 'react-router-dom'
import useAuth from './hooks/useAuth'
import Layout from './components/Layout'

import Login        from './pages/Login'
import Dashboard    from './pages/Dashboard'
import Tickets      from './pages/Tickets'
import TicketDetail from './pages/TicketDetail'
import NewTicket    from './pages/NewTicket'
import Devices      from './pages/Devices'
import DeviceDetail from './pages/DeviceDetail'
import Clients      from './pages/Clients'
import AIDiagnostics from './pages/AIDiagnostics'
import RemoteAccess from './pages/RemoteAccess'
import Alerts       from './pages/Alerts'
import Settings            from './pages/Settings'
import ClientPortal        from './pages/ClientPortal'
import CustomerManagement  from './pages/CustomerManagement'
import UserManagement       from './pages/UserManagement'
import CustomerDevices      from './pages/CustomerDevices'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"         element={<Login />} />
      <Route path="/client-portal" element={<ClientPortal />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index                            element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"                 element={<Dashboard />} />
        <Route path="tickets"                   element={<Tickets />} />
        <Route path="tickets/new"               element={<NewTicket />} />
        <Route path="tickets/:id"               element={<TicketDetail />} />
        <Route path="devices"                   element={<Devices />} />
        <Route path="devices/:id"               element={<DeviceDetail />} />
        <Route path="clients"                   element={<Clients />} />
        <Route path="ai-diagnostics"            element={<AIDiagnostics />} />
        <Route path="remote-access"             element={<RemoteAccess />} />
        <Route path="alerts"                    element={<Alerts />} />
        <Route path="settings"                  element={<Settings />} />
        <Route path="customer-management"       element={<CustomerManagement />} />
        <Route path="customer-devices"          element={<CustomerDevices />} />
        <Route path="users"                     element={<UserManagement />} />
      </Route>
    </Routes>
  )
}
