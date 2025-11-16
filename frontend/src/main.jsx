import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'


import HomePage from './Pages/Home/Home.jsx';


createRoot(document.getElementById('root')).render(
  <StrictMode>
{/* <Rate/> */}

<HomePage/>
  </StrictMode>
)
