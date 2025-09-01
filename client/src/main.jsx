import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import Home from './pages/Home.jsx'
import Play from './pages/Play.jsx'
import Lore from './pages/Lore.jsx'
import Credits from './pages/Credits.jsx'
import './styles.css'

const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <Home /> },
    { path: '/play', element: <Play /> },
    { path: '/lore', element: <Lore /> },
    { path: '/credits', element: <Credits /> },
  ]}
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
