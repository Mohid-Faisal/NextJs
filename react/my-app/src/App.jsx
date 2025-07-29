import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <h1>React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          increase count
        </button>
        <button onClick={() => setCount((count) => count - 1)}>
          decrease count
        </button>
        <button onClick={() => setCount(0)}>
          reset count
        </button>
        <div>
          {count}
        </div>
      </div>
    </>
  )
}

export default App
