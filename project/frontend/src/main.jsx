import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Initialize theme from localStorage
const savedTheme = localStorage.getItem('theme-storage');
if (savedTheme) {
  try {
    const theme = JSON.parse(savedTheme).state.theme;
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
} else {
  document.documentElement.setAttribute('data-theme', 'light');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)