import { useRef, useState } from 'react'
import { TOKEN_COLORS } from './terrains'

// Orden de turnos: claves 't<id>' (jugador) y 'e<id>' (enemigo). Por defecto jugadores y luego enemigos;
// el master reordena arrastrando una ficha sobre otra. Solo visual.
const find = (map, k) => (k[0] === 't' ? map.tokens : map.enemies).find((p) => p.id === +k.slice(1))

export default function TurnBar({ map, order, isMaster, onChange }) {
  const drag = useRef(null)
  const [over, setOver] = useState(null)
  const all = [
    ...map.tokens.filter((t) => t.pos !== null).map((t) => 't' + t.id),
    ...map.enemies.filter((e) => e.pos !== null).map((e) => 'e' + e.id),
  ]
  const list = [...order.filter((k) => all.includes(k)), ...all.filter((k) => !order.includes(k))]

  const down = (e, k) => {
    if (!isMaster) return
    drag.current = k
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e) => {
    if (!drag.current) return
    setOver(document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-k]')?.dataset.k ?? null)
  }
  const up = () => {
    const from = drag.current
    const to = over
    drag.current = null
    setOver(null)
    if (!from || !to || from === to) return
    const next = list.filter((k) => k !== from)
    next.splice(list.indexOf(to), 0, from)
    onChange(next)
  }

  if (!list.length) return null
  return (
    <div className="turns">
      {list.map((k) => (
        <span
          key={k}
          data-k={k}
          className={`turn${isMaster ? ' turn-drag' : ''}${over === k ? ' turn-over' : ''}${find(map, k)?.dead ? ' turn-dead' : ''}`}
          onPointerDown={(e) => down(e, k)}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => { drag.current = null; setOver(null) }}
        >
          <span
            className={`swatch round${k[0] === 'e' ? ' enemy-swatch' : ''}`}
            style={k[0] === 't' ? { background: TOKEN_COLORS[+k.slice(1)] } : undefined}
          >
            {k[0] === 't' ? +k.slice(1) + 1 : 'E' + k.slice(1)}
          </span>
        </span>
      ))}
    </div>
  )
}
