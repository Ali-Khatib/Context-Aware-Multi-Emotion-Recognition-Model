import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AnalysisProvider } from './context/AnalysisContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnalysisProvider>
      <App />
    </AnalysisProvider>
  </StrictMode>,
)
