import React from 'react'
import ReactDOM from 'react-dom/client'
import { DndProvider } from 'react-dnd'
import { TouchBackend } from 'react-dnd-touch-backend'
import App from './App'
import './index.css'

// TouchBackend with enableMouseEvents replicates the approach ox_inventory
// uses successfully in FiveM CEF: drag operations run through pointer events
// (mousedown / mousemove / mouseup), bypassing CEF's flaky HTML5 native
// drag implementation that silently refuses to initiate a drag on some
// builds. Same options ox_inventory ships with in production.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DndProvider backend={TouchBackend} options={{ enableMouseEvents: true }}>
      <App />
    </DndProvider>
  </React.StrictMode>
)
