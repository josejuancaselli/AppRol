import { useEffect, useState } from 'react'
import './ui.css'

let push = null
let nextId = 0
const ask = (cfg) => new Promise((resolve) => push?.({ ...cfg, resolve, id: nextId++ }))

export const alertBox = (text, title = 'Aviso') =>
  ask({ title, text, actions: [{ label: 'Aceptar', value: true, kind: 'primary' }] })

export const confirmBox = (text, { title = 'Confirmar', ok = 'Aceptar', danger = false } = {}) =>
  ask({
    title, text,
    actions: [
      { label: ok, value: true, kind: danger ? 'danger' : 'primary' },
      { label: 'Cancelar', value: false, kind: 'ghost' },
    ],
  })

// devuelve el texto escrito, o null si se cancela
export const promptBox = (text, { title = 'Escribí', value = '', type = 'text', ok = 'Aceptar' } = {}) =>
  ask({
    title, text, input: { value, type },
    actions: [
      { label: ok, value: true, kind: 'primary' },
      { label: 'Cancelar', value: false, kind: 'ghost' },
    ],
  })

// varias opciones: devuelve el valor de la acción elegida
// actions: [{ label, value, kind: 'primary' | 'danger' | 'ghost' }]
export const choose = (title, text, actions) => ask({ title, text, actions })

export function Dialogs() {
  const [list, setList] = useState([])
  useEffect(() => {
    push = (d) => setList((l) => [...l, d])
    return () => { push = null }
  }, [])
  const d = list[0]
  if (!d) return null
  return <Box key={d.id} d={d} onDone={(v) => { d.resolve(v); setList((l) => l.slice(1)) }} />
}

function Box({ d, onDone }) {
  const [val, setVal] = useState(d.input?.value ?? '')
  const finish = (a) => onDone(d.input ? (a.value === true ? val : null) : a.value)
  const main = d.actions.find((a) => a.value === true)

  return (
    <div className="ui-back">
      <form className="ui-dlg" role="dialog" aria-modal="true" aria-labelledby="ui-dlg-t"
        onSubmit={(e) => { e.preventDefault(); if (main) finish(main) }}>
        <span className="ui-handle" aria-hidden="true" />
        <h2 id="ui-dlg-t" className="ui-dlg-title">{d.title}</h2>
        {d.text && <p className="ui-dlg-text">{d.text}</p>}
        {d.input && (
          <input className="ui-field" type={d.input.type} value={val} autoFocus aria-label={d.title}
            onChange={(e) => setVal(e.target.value)} />
        )}
        <div className="ui-dlg-actions">
          {d.actions.map((a) => (
            <button key={a.label} type="button" className={`ui-btn ui-btn-${a.kind}`} onClick={() => finish(a)}>
              {a.label}
            </button>
          ))}
        </div>
      </form>
    </div>
  )
}