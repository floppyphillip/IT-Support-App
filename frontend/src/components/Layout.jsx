import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import useAuthStore from '../store/authStore'
import ForcePasswordChangeModal from './ForcePasswordChangeModal'

export default function Layout() {
  const forcePasswordChange = useAuthStore((s) => s.user?.force_password_change)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div id="overlay-root" className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-5 pb-20 md:pb-5">
          <Outlet />
        </main>
      </div>
      {forcePasswordChange && <ForcePasswordChangeModal />}
    </div>
  )
}
