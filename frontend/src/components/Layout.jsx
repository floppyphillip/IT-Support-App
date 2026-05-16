import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0d1526' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-5 pb-20 md:pb-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
