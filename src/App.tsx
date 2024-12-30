import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import QuiltDesigner from './components/QuiltDesigner'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className='bg-gray-950 h-screen w-screen flex items-center justify-center'>
      <QuiltDesigner/>
    </div>
  )
}

export default App
