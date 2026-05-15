import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authAPI } from '../api/client'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,

      login: async (email, password) => {
        const { data } = await authAPI.login({ email, password })
        // Refresh token is set as httpOnly cookie by the server — no localStorage
        localStorage.setItem('access_token', data.access_token)
        const { data: user } = await authAPI.me()
        set({ user, accessToken: data.access_token })
        return user
      },

      logout: async () => {
        try { await authAPI.logout() } catch { /* ignore */ }
        localStorage.removeItem('access_token')
        set({ user: null, accessToken: null })
      },

      fetchMe: async () => {
        try {
          const { data } = await authAPI.me()
          set({ user: data })
          return data
        } catch {
          get().logout()
          return null
        }
      },

      updateUser: (updates) => set((s) => ({ user: { ...s.user, ...updates } })),

      isSuperadmin: () => get().user?.role === 'superadmin',
      isEngineer:   () => ['superadmin', 'engineer'].includes(get().user?.role),
      isClient:     () => get().user?.role === 'client',
    }),
    {
      name: 'netsupportai-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken }),
    }
  )
)

export default useAuthStore
