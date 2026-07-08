import React from 'react'
import ReactDOM from 'react-dom/client'
import MerchantAuth from './MerchantAuth.tsx'
import Dashboard from './Dashboard.tsx'
import MerchantSettings from './MerchantSettings.tsx'
import './index.css'

const path = window.location.pathname

let Component = MerchantAuth

if (path === '/merchant/dashboard') Component = Dashboard
else if (path === '/merchant/settings') Component = MerchantSettings
else if (path === '/merchant' || path === '/merchant/') Component = MerchantAuth

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
)
