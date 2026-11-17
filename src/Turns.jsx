import { useState } from 'react'
import { tokenStyle } from './terrains'

// Orden de turnos: claves 't<id>' (jugador) y 'e<id>' (enemigo). Por defecto jugadores y luego enemigos.
// El master toca una ficha para seleccionarla y toca otra para intercambiar sus lugares. Solo visual.
const find = (map, k) => (k[0] === 't' ? map.tokens : map.enemies).find((p) => p.id === +k.slice(1))

export default function TurnBar({ map, order, isMaster, onChange }) {
  const [sel, setSel] = useState(null)
  const all = [
    ...map.tokens.filter((t) => t.pos !== null).map((t) => 't' + t.id),
    ...map.enemies.filter((e) => e.pos !== null).map((e) => 'e' + e.id),
  ]
  const list = [...order.filter((k) => all.includes(k)), ...all.filter((k) => !order.includes(k))]

  const tap = (k) => {
    if (!isMaster) return
    if (sel === null || !list.includes(sel) || sel === k) return setSel(sel === k ? null : k)
    const next = list.slice()
    const a = next.indexOf(sel)
    const b = next.indexOf(k)
    ;[next[a], next[b]] = [next[b], next[a]]
    setSel(null)
    onChange(next)
  }

  if (!list.length) return null
  return (
    <div className="turns">
      {list.map((k) => {
        const p = find(map, k)
        return (
          <span
            key={k}
            className={`turn${sel === k ? ' turn-sel' : ''}${p?.dead ? ' turn-dead' : ''}`}
            onClick={() => tap(k)}
          >
            {k[0] === 't' ? (
              <span className="swatch round" style={tokenStyle(+k.slice(1))}>{+k.slice(1) + 1}</span>
            ) : (
              <span className={`swatch round enemy-swatch${p?.boss ? ' boss' : ''}`}>{p?.boss ? 'J' : 'E'}{k.slice(1)}</span>
            )}
          </span>
        )
      })}
    </div>
  )
}
