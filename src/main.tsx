import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// Предупреждение о React DevTools hook обычно связано с расширениями браузера
// и не влияет на работу приложения - можно игнорировать

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

