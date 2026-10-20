import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Red de seguridad para imágenes: si alguna no carga (sin internet, archivo faltante,
// formato no soportado), se reemplaza por un recuadro con las iniciales del alt
// en los colores de Kampuz, en vez del ícono de imagen rota.
const iniciales = (texto = '') =>
  texto.split(/\s+/).filter(w => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'K'

const placeholder = (alt) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#2F2A6B"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="36" fill="#00A896">${iniciales(alt)}</text></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

window.addEventListener('error', (e) => {
  const img = e.target
  if (img && img.tagName === 'IMG' && !img.dataset.fallback) {
    img.dataset.fallback = '1'
    img.src = placeholder(img.alt)
  }
}, true)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
