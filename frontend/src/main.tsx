import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import OrderSuccess from './OrderSuccess.tsx'
import Import from './Import.tsx'
import MerchantAuth from './MerchantAuth.tsx'
import Dashboard from './Dashboard.tsx'
import MerchantSettings from "./MerchantSettings.tsx"
import Admin from "./Admin.tsx"
import ImageEditor from "./ImageEditor.tsx"
import BulkEditor from "./BulkEditor.tsx"
import './index.css'

const path = window.location.pathname
if (path === '/image-editor') {
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ImageEditor /></React.StrictMode>)
} else

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {path === '/order-success' ? <OrderSuccess /> :
     path === '/import' ? <Import /> :
     path === '/merchant' ? <MerchantAuth /> :
     path === "/dashboard" ? <Dashboard /> :
     path === "/settings" ? <MerchantSettings /> :
     path === "/admin" ? <Admin /> :
     path === "/staff/bulk-editor" ? <BulkEditor /> :
     <App />}
  </React.StrictMode>,
)
