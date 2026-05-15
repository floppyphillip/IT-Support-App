import useAuthStore from '../store/authStore'

export default function useAuth() {
  const { user, login, logout, fetchMe, isSuperadmin, isEngineer, isClient, accessToken } = useAuthStore()
  return {
    user,
    accessToken,
    isAuthenticated: !!accessToken && !!user,
    isSuperadmin,
    isEngineer,
    isClient,
    login,
    logout,
    fetchMe,
  }
}
