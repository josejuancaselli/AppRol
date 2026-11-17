import { useState } from 'react'
import { TOKEN_COLORS } from './terrains'

// Orden de turnos: lista de claves 't<id>' (jugador) o 'e<id>' (enemigo). Solo visual, no bloquea nada.
const find = (map, k) => (k[0] === 't' ? map.tokens : map.enemies).find((p) => p.id === +k.slice(1))

export default function TurnBar({ map, order, isMaster, onChange }) {
  const [edit, setEdit] = useState(false)
  const all = [
    ...map.tokens.filter((t) => t.pos !== null).map((t) => 't' + t.id),
    ...map.enemies.filter((e) => e.pos !== null).map((e) => 'e' + e.id),
  ]
  const live = order.filter((k) => all.includes(k))
  const shown = edit ? all : live
  const toggle = (k) => onChange(live.includes(k) ? live.filter((x) => x !== k) : [...live, k])

  return (
    <div className="turns">
      <div className="turn-list">
        {shown.length === 0 && <span className="turn-empty">Sin orden de turnos</span>}
        {shown.map((k) => {
          const n = live.indexOf(k)
          const dead = find(map, k)?.dead
          return (
            <button
              key={k}
              className={`tool turn${!edit && n === 0 ? ' turn-now' : ''}${dead ? ' turn-dead' : ''}`}
              aria-pressed={edit && n >= 0}
              disabled={!edit}
              onClick={() => toggle(k)}
            >
              {n >= 0 && <b>{n + 1}</b>}
              <span
                className={`swatch round sm${k[0] === 'e' ? ' enemy-swatch' : ''}`}
                style={k[0] === 't' ? { background: TOKEN_COLORS[+k.slice(1)] } : undefined}
              >
                {k[0] === 't' ? +k.slice(1) + 1 : 'E' + k.slice(1)}
              </span>
            </button>
          )
        })}
      </div>
      {isMaster && (
        <div className="turn-ctl">
          {!edit && live.length > 1 && <button onClick={() => onChange([...live.slice(1), live[0]])}>Siguiente</button>}
          <button onClick={() => setEdit(!edit)}>{edit ? 'Listo' : 'Orden'}</button>
          {edit && <button onClick={() => onChange([])}>Borrar</button>}
        </div>
      )}
    </div>
  )
}
