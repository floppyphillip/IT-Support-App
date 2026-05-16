import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0c1018',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#c8d3e8',
            borderRadius: '10px',
            fontSize: '12px',
            fontFamily: "'Inter Tight', system-ui, sans-serif",
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#0c1018' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#0c1018' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
