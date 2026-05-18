import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
  withCredentials: true, // send httpOnly refresh_token cookie automatically
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401 using httpOnly cookie (no refresh_token in localStorage)
let _refreshing = false
let _queue = []

const processQueue = (error, token = null) => {
  _queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
  _queue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (_refreshing) {
        return new Promise((resolve, reject) => {
          _queue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      _refreshing = true

      try {
        // Cookie is sent automatically — no body needed
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        localStorage.setItem('access_token', data.access_token)
        api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
        processQueue(null, data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch (err) {
        processQueue(err, null)
        localStorage.removeItem('access_token')
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        _refreshing = false
      }
    }
    return Promise.reject(error)
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Routes: /login /logout /refresh /me /change-password /invite /users /{id} /me/notifications
// None are collection "/" routes — no trailing slashes
export const authAPI = {
  login:              (data) => api.post('/auth/login', data),
  logout:             ()     => api.post('/auth/logout'),
  refresh:            ()     => api.post('/auth/refresh', {}),
  me:                 ()     => api.get('/auth/me'),
  updateMe:           (data) => api.put('/auth/me', data),
  changePassword:     (data) => api.post('/auth/change-password', data),
  listUsers:          ()     => api.get('/auth/users'),
  updateUser:         (id, d)=> api.put(`/auth/users/${id}`, d),
  inviteUser:         (data) => api.post('/auth/invite', data),
  getNotifications:   ()     => api.get('/auth/me/notifications'),
  updateNotifications:(d)    => api.put('/auth/me/notifications', d),
}

// ─── Tickets ──────────────────────────────────────────────────────────────────
// Collection routes GET "/" and POST "/" need trailing slash; item routes do not
export const ticketsAPI = {
  list:        (params) => api.get('/tickets/', { params }),
  get:         (id)     => api.get(`/tickets/${id}`),
  create:      (data)   => api.post('/tickets/', data),
  update:      (id, d)  => api.put(`/tickets/${id}`, d),
  delete:      (id)     => api.delete(`/tickets/${id}`),
  addMessage:  (id, d)  => api.post(`/tickets/${id}/messages`, d),
  getMessages: (id)     => api.get(`/tickets/${id}/messages`),
}

// ─── Devices ──────────────────────────────────────────────────────────────────
export const devicesAPI = {
  list:            (params) => api.get('/devices/', { params }),
  get:             (id)     => api.get(`/devices/${id}`),
  create:          (data)   => api.post('/devices/', data),
  update:          (id, d)  => api.put(`/devices/${id}`, d),
  delete:          (id)     => api.delete(`/devices/${id}`),
  ping:            (id)     => api.post(`/devices/${id}/ping`),
  snmp:            (id)     => api.post(`/devices/${id}/snmp`),
  getMetrics:      (id, p)  => api.get(`/devices/${id}/metrics`, { params: p }),
  backupConfig:    (id)     => api.post(`/devices/${id}/backup-config`),
  getConfigBackups:(id)     => api.get(`/devices/${id}/config-backups`),
  getConfigBackup: (id, bid)=> api.get(`/devices/${id}/config-backups/${bid}`),
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export const clientsAPI = {
  list:   (params) => api.get('/clients/', { params }),
  get:    (id)     => api.get(`/clients/${id}`),
  create: (data)   => api.post('/clients/', data),
  update: (id, d)  => api.put(`/clients/${id}`, d),
  delete: (id)     => api.delete(`/clients/${id}`),
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertsAPI = {
  list:        (params) => api.get('/alerts/', { params }),
  get:         (id)     => api.get(`/alerts/${id}`),
  acknowledge: (id)     => api.post(`/alerts/${id}/acknowledge`),
  resolve:     (id)     => api.post(`/alerts/${id}/resolve`),
  delete:      (id)     => api.delete(`/alerts/${id}`),
}

// ─── AI ───────────────────────────────────────────────────────────────────────
// Routes: /diagnose /analyze-config /interpret-logs /classify-ticket /generate-report
// All defined without trailing slash on the backend
export const aiAPI = {
  diagnose:       (data) => api.post('/ai/diagnose', data),
  analyzeConfig:  (data) => api.post('/ai/analyze-config', data),
  interpretLogs:  (data) => api.post('/ai/interpret-logs', data),
  classifyTicket: (data) => api.post('/ai/classify-ticket', data),
  generateReport: (data) => api.post('/ai/generate-report', data),
}

// ─── Remote Access ────────────────────────────────────────────────────────────
export const remoteAPI = {
  getCommandPalette: ()      => api.get('/remote/commands/palette'),
  exec:              (data)  => api.post('/remote/exec', data),
  deviceExec:        (id, d) => api.post(`/remote/devices/${id}/exec`, d),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  stats:          ()      => api.get('/dashboard/stats'),
  networkHealth:  ()      => api.get('/dashboard/network-health'),
  recentActivity: (limit) => api.get('/dashboard/recent-activity', { params: { limit } }),
}

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsAPI = {
  sendAlert: (data) => api.post('/notifications/alert', data),
  sendEmail: (data) => api.post('/notifications/email', data),
}

export default api
