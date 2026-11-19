import { useEffect, useState } from 'react'
import { subscribe } from './notify.js'

export default function Toasts() {
  const [list, setList] = useState([])

  useEffect(() => subscribe((m) => {
    setList((l) => (l.some((x) => x.text === m.text) ? l : [...l.slice(-3), m]))
    setTimeout(() => setList((l) => l.filter((x) => x.id !== m.id)), m.kind === 'error' ? 6000 : 3000)
  }), [])

  if (!list.length) return null
  return (
    <div className="toasts">
      {list.map((m) => (
        <div key={m.id} className={`toast${m.kind === 'error' ? ' error' : ''}`}
          role={m.kind === 'error' ? 'alert' : 'status'}>
          {m.text}
        </div>
      ))}
    </div>
  )
}
