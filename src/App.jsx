import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, deleteField } from 'firebase/firestore'
import { db } from './firebase'
import { KIND_ORDER, KIND_LABEL, TERRAINS, TERRAIN_BY_ID, TOKEN_COLORS } from './terrains'
import { MODIFIERS, MOD_GROUPS, MOD_BY_ID } from './modifiers'
import { EDGES, EDGE_LABEL, EdgeLayer, nearestEdge, edgeInside } from './Edges'
import { sampleMap, toDoc, fromDoc, diff, newRoomCode } from './roomData'
import './App.css'
import './room.css'
import './edges.css'

const GRID_SIZES = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24]
let CLIENT = localStorage.getItem('rol-client')
if (!CLIENT) localStorage.setItem('rol-client', (CLIENT = Math.random().toString(36).slice(2)))

// Busca la ficha o enemigo (vivo o muerto) que está en la celda i
const findPiece = (m, i, dead) => {
  const token = m.tokens.find((p) => p.pos === i && !!p.dead === dead)
  if (token) return { list: 'tokens', piece: token }
  const enemy = m.enemies.find((p) => p.pos === i && !!p.dead === dead)
  return enemy ? { list: 'enemies', piece: enemy } : null
}

const patchPiece = (m, list, id, patch) => ({
  ...m,
  [list]: m[list].map((p) => (p.id === id ? { ...p, ...patch } : p)),
})

// Si hay una ficha viva en la celda la mata; si solo hay cadáveres, revive uno
const toggleDeadIn = (m, i) => {
  const live = findPiece(m, i, false)
  if (live) return patchPiece(m, live.list, live.piece.id, { dead: true })
  const corpse = findPiece(m, i, true)
  return corpse ? patchPiece(m, corpse.list, corpse.piece.id, { dead: false }) : m
}

const GROUPS = {
  terrain: KIND_ORDER.map((k) => ({
    label: KIND_LABEL[k],
    items: [
      ...TERRAINS.filter((t) => t.kind === k).map((t) => ({ id: t.id, label: t.label })),
      ...(k === 'construccion' ? EDGES.map((id) => ({ id, label: EDGE_LABEL[id] })) : []),
    ],
  })),
  mod: [
    { label: 'Sin efecto', items: [{ id: 'none', label: 'Quitar' }] },
    ...MOD_GROUPS.map((g) => ({
      label: g.label,
      items: MODIFIERS.filter((m) => m.group === g.id).map((m) => ({ id: m.id, label: m.label })),
    })),
  ],
  token: [{
    label: 'Fichas',
    items: [
      ...TOKEN_COLORS.map((_, i) => ({ id: i, label: `Jugador ${i + 1}` })),
      { id: 'none', label: 'Quitar' },
    ],
  }],
  enemy: [{
    label: 'Enemigos',
    items: [
      { id: 'add', label: 'Agregar enemigo' },
      { id: 'none', label: 'Quitar enemigo' },
    ],
  }],
}
const TITLES = { terrain: 'Terreno', mod: 'Modificadores', token: 'Fichas', enemy: 'Enemigos' }

function Swatch({ kind, id, small }) {
  const sm = small ? ' sm' : ''
  if (id === 'none') return <span className={`swatch round dark${sm}`}>×</span>
  if (kind === 'terrain') return <span className={`swatch t-${id}${sm}`} />
  if (kind === 'mod') {
    return <span className={`swatch t-grass${sm}`}><span className={`m m-${id}`} /></span>
  }
  if (kind === 'enemy') return <span className={`swatch round enemy-swatch${sm}`}>E</span>
  return <span className={`swatch round${sm}`} style={{ background: TOKEN_COLORS[id] }}>{id + 1}</span>
}

export default function App() {
  const [code, setCode] = useState(() =>
    (new URLSearchParams(location.search).get('sala') || localStorage.getItem('rol-sala') || '').toUpperCase())
  const [input, setInput] = useState('')
  const [data, setData] = useState(undefined)

  useEffect(() => {
    if (!code) return
    setData(undefined)
    return onSnapshot(doc(db, 'rooms', code), (s) => setData(s.exists() ? s.data() : null))
  }, [code])

  const enter = (c) => {
    c = c.trim().toUpperCase()
    if (!c) return
    localStorage.setItem('rol-sala', c)
    setCode(c)
  }
  const leave = () => {
    localStorage.removeItem('rol-sala')
    history.replaceState(null, '', location.pathname)
    setCode('')
  }
  const create = async () => {
    const c = newRoomCode()
    await setDoc(doc(db, 'rooms', c), toDoc(sampleMap(), CLIENT))
    enter(c)
  }

  if (code && data) return <Room code={code} data={data} onLeave={leave} />

  return (
    <main className="app lobby">
      <header className="top"><h1>Mapa de rol</h1></header>
      {code && data === undefined && <p>Cargando sala…</p>}
      {code && data === null && <p>La sala {code} no existe</p>}
      {(!code || data === null) && (
        <div className="tools">
          <button className="tool" onClick={create}>Crear sala</button>
          <input className="room-input" placeholder="Código" value={input}
            onChange={(e) => setInput(e.target.value)} />
          <button className="tool" onClick={() => enter(input)}>Entrar</button>
        </div>
      )}
      {code && <button className="tool" onClick={leave}>Salir</button>}
    </main>
  )
}

function Room({ code, data, onLeave }) {
  const roomRef = doc(db, 'rooms', code)
  const isMaster = data.master === CLIENT
  const mine = Object.keys(data.claims ?? {}).find((k) => data.claims[k] === CLIENT)
  const myToken = mine === undefined ? null : Number(mine)

  if (!isMaster && myToken === null) {
    return (
      <main className="app lobby">
        <header className="top"><h1>Elegí tu ficha</h1></header>
        <div className="tools">
          {TOKEN_COLORS.map((_, id) => (
            <button key={id} className="tool" disabled={!!data.claims?.[id]}
              onClick={() => updateDoc(roomRef, { ['claims.' + id]: CLIENT })}>
              <Swatch kind="token" id={id} />Jugador {id + 1}
            </button>
          ))}
        </div>
        <button className="tool" onClick={onLeave}>Salir</button>
      </main>
    )
  }
  return <Board roomRef={roomRef} code={code} data={data} isMaster={isMaster} myToken={myToken} onLeave={onLeave} />
}

function Board({ roomRef, code, data, isMaster, myToken, onLeave }) {
  const map = fromDoc(data)
  const [mode, setMode] = useState(isMaster ? 'edit' : 'play')
  const [picks, setPicks] = useState({ terrain: 'rock', mod: 'fire', token: 0, enemy: 'add' })
  const [active, setActive] = useState(isMaster ? 'terrain' : 'move')
  const [open, setOpen] = useState(null)
  const [selected, setSelected] = useState(myToken)
  const [selectedEnemy, setSelectedEnemy] = useState(null)
  const [focus, setFocus] = useState(null)
  const lastTap = useRef({ i: -1, t: 0, undo: null })

  const liveToken = (i) => map.tokens.find((t) => t.pos === i && !t.dead)
  const liveEnemy = (i) => map.enemies.find((e) => e.pos === i && !e.dead)
  // En Editar se sigue viendo cualquier ficha de la celda (viva primero)
  const tokenAt = (i) => liveToken(i) ?? map.tokens.find((t) => t.pos === i)
  const enemyAt = (i) => liveEnemy(i) ?? map.enemies.find((e) => e.pos === i)

  const change = (next) => {
    const u = diff(map, next)
    if (Object.keys(u).length) updateDoc(roomRef, u)
  }

  const resizeGrid = (dimension, value) => {
    const cols = dimension === 'cols' ? value : map.cols
    const rows = dimension === 'rows' ? value : map.rows
    if (cols === map.cols && rows === map.rows) return

    const cells = Array(cols * rows).fill('grass')
    const mods = Array(cols * rows).fill(null)
    for (let row = 0; row < Math.min(rows, map.rows); row++) {
      for (let col = 0; col < Math.min(cols, map.cols); col++) {
        const oldIndex = row * map.cols + col
        const newIndex = row * cols + col
        cells[newIndex] = map.cells[oldIndex]
        mods[newIndex] = map.mods[oldIndex]
      }
    }

    const remapPieces = (pieces) => pieces.map((piece) => {
      if (piece.pos === null) return piece
      const row = Math.floor(piece.pos / map.cols)
      const col = piece.pos % map.cols
      return { ...piece, pos: row < rows && col < cols ? row * cols + col : null }
    })

    const edges = Object.fromEntries(Object.entries(map.edges).filter(([k]) => edgeInside(k, cols, rows)))
    change({ cols, rows, cells, mods, edges, tokens: remapPieces(map.tokens), enemies: remapPieces(map.enemies) })
    setFocus(null)
    setSelected(null)
    setSelectedEnemy(null)
  }

  const moveToken = (tokenId, pos) => ({
    ...map,
    tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, pos, dead: false } : t)),
  })

  const moveEnemy = (enemyId, pos) => ({
    ...map,
    enemies: map.enemies.map((e) => (e.id === enemyId ? { ...e, pos, dead: false } : e)),
  })

  const applyTool = (i) => {
    if (active === 'terrain') {
      if (EDGES.includes(picks.terrain)) return
      if (map.cells[i] === picks.terrain) return
      const cells = map.cells.slice()
      cells[i] = picks.terrain
      change({ ...map, cells })
    } else if (active === 'mod') {
      const id = picks.mod === 'none' ? null : picks.mod
      if (map.mods[i] === id) return
      const mods = map.mods.slice()
      mods[i] = id
      change({ ...map, mods })
    } else if (active === 'token') {
      if (picks.token === 'none') {
        const t = tokenAt(i)
        if (t) change(moveToken(t.id, null))
      } else if (!tokenAt(i) && !enemyAt(i)) {
        change(moveToken(picks.token, i))
      }
    } else if (active === 'enemy') {
      const enemy = enemyAt(i)
      if (picks.enemy === 'none') {
        if (enemy) change(moveEnemy(enemy.id, null))
      } else if (picks.enemy === 'add' && !enemy && !tokenAt(i)) {
        const nextId = map.enemies.reduce((max, item) => Math.max(max, item.id), 0) + 1
        change({ ...map, enemies: [...map.enemies, { id: nextId, pos: i }] })
      }
    }
  }

  const placeEdge = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const k = nearestEdge(((e.clientX - r.left) / r.width) * map.cols, ((e.clientY - r.top) / r.height) * map.rows, map.cols, map.rows)
    const edges = { ...map.edges }
    if (picks.terrain === 'none' || edges[k] === picks.terrain) delete edges[k]
    else edges[k] = picks.terrain
    change({ ...map, edges })
  }

  const playCell = (i) => {
    setFocus(i)

    // Doble toque sobre una ficha, enemigo o cadáver: matar / revivir
    const now = Date.now()
    const last = lastTap.current
    const isDouble = isMaster && last.i === i && now - last.t < 350
    lastTap.current = { i, t: now, undo: null }
    if (isDouble && (last.undo || findPiece(map, i, false) || findPiece(map, i, true))) {
      lastTap.current = { i: -1, t: 0, undo: null }
      // Si el primer toque movió una ficha sobre un cadáver, se deshace ese movimiento y se revive el cadáver
      const base = last.undo ? patchPiece(map, last.undo.list, last.undo.id, { pos: last.undo.from }) : map
      change(toggleDeadIn(base, i))
      setSelected(null)
      setSelectedEnemy(null)
      return
    }

    if (active === 'mod') return applyTool(i)

    // Una ficha o enemigo vivo se selecciona; los cadáveres no cuentan
    const enemy = liveEnemy(i)
    if (enemy) {
      if (!isMaster) return
      setSelected(null)
      setSelectedEnemy(selectedEnemy === enemy.id ? null : enemy.id)
      return
    }

    const token = liveToken(i)
    if (token) {
      if (!isMaster && token.id !== myToken) return
      setSelectedEnemy(null)
      setSelected(selected === token.id ? null : token.id)
      return
    }

    // Celda sin ficha viva (puede tener cadáveres): se puede mover a cualquier terreno
    const hasCorpse = !!findPiece(map, i, true)
    if (selected !== null) {
      if (map.tokens[selected].dead) return
      const from = map.tokens.find((t) => t.id === selected)?.pos ?? null
      change(moveToken(selected, i))
      lastTap.current = hasCorpse ? { i, t: now, undo: { list: 'tokens', id: selected, from } } : { i: -1, t: 0, undo: null }
    } else if (selectedEnemy !== null) {
      const from = map.enemies.find((e) => e.id === selectedEnemy)?.pos ?? null
      change(moveEnemy(selectedEnemy, i))
      lastTap.current = hasCorpse ? { i, t: now, undo: { list: 'enemies', id: selectedEnemy, from } } : { i: -1, t: 0, undo: null }
    }
  }

  const switchMode = (m) => {
    setMode(m)
    setActive(m === 'play' ? 'move' : 'terrain')
    setSelected(null)
    setSelectedEnemy(null)
    setFocus(null)
    setOpen(null)
  }

  const pick = (kind, id) => {
    setPicks({ ...picks, [kind]: id })
    setActive(kind)
    setSelected(null)
    setSelectedEnemy(null)
    setOpen(null)
  }

  const clearTerrain = () => change({ ...map, edges: {}, cells: Array(map.cols * map.rows).fill('grass') })
  const clearMods = () => change({ ...map, mods: Array(map.cols * map.rows).fill(null) })

  const valueLabel = {
    terrain: EDGE_LABEL[picks.terrain] ?? TERRAIN_BY_ID[picks.terrain].label,
    mod: picks.mod === 'none' ? 'Quitar' : MOD_BY_ID[picks.mod].label,
    token: picks.token === 'none' ? 'Quitar' : `Jugador ${picks.token + 1}`,
    enemy: picks.enemy === 'none' ? 'Quitar enemigo' : 'Agregar enemigo',
  }

  const drops = isMaster && mode === 'edit' ? ['terrain', 'mod', 'token', 'enemy'] : ['mod']
  const placed = map.tokens.filter((t) => t.pos !== null)
  const placedEnemies = map.enemies.filter((e) => e.pos !== null)

  return (
    <main className="app">
      <header className="top">
        <h1>Mapa de rol</h1>
        {isMaster && (
          <div className="modes">
            <button aria-pressed={mode === 'edit'} onClick={() => switchMode('edit')}>Editar</button>
            <button aria-pressed={mode === 'play'} onClick={() => switchMode('play')}>Jugar</button>
          </div>
        )}
      </header>
      <div className="room-bar">
        <span>Sala {code}</span>
        <span>
          <button onClick={() => navigator.clipboard?.writeText(`${location.origin}${location.pathname}?sala=${code}`)}>Copiar link</button>
          {!isMaster && <button onClick={() => updateDoc(roomRef, { ['claims.' + myToken]: deleteField() })}>Cambiar ficha</button>}
          <button onClick={onLeave}>Salir</button>
        </span>
      </div>

      {isMaster && mode === 'edit' && (
        <div className="grid-size">
          <label>
            Columnas
            <select value={map.cols} onChange={(e) => resizeGrid('cols', Number(e.target.value))}>
              {GRID_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <label>
            Filas
            <select value={map.rows} onChange={(e) => resizeGrid('rows', Number(e.target.value))}>
              {GRID_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="board">
      <div className="grid" style={{ '--cols': map.cols }}>
        {map.cells.map((id, i) => {
          const tok = liveToken(i)
          const enemy = liveEnemy(i)
          const deadTok = map.tokens.find((t) => t.pos === i && t.dead)
          const deadEnemy = map.enemies.find((e) => e.pos === i && e.dead)
          const mod = map.mods[i]
          let label = `Fila ${Math.floor(i / map.cols) + 1}, columna ${(i % map.cols) + 1}: ${TERRAIN_BY_ID[id].label}`
          if (mod) label += `, ${MOD_BY_ID[mod].label}`
          const here = [
            ...map.tokens.filter((t) => t.pos === i).map((t) => `jugador ${t.id + 1}${t.dead ? ' (muerto)' : ''}`),
            ...map.enemies.filter((e) => e.pos === i).map((e) => `enemigo E${e.id}${e.dead ? ' (muerto)' : ''}`),
          ]
          if (here.length) label += `, ${here.join(', ')}`
          return (
            <button
              key={i}
              className={`cell t-${id}${mode === 'play' && focus === i ? ' focus' : ''}`}
              aria-label={label}
              onClick={() => (mode === 'edit' ? applyTool(i) : playCell(i))}
            >
              {mod && <span className={`m m-${mod}`} />}
              {tok && (
                <span
                  className={`token${selected === tok.id ? ' token-selected' : ''}`}
                  style={{ background: TOKEN_COLORS[tok.id] }}
                >
                  {tok.id + 1}
                </span>
              )}
              {enemy && (
                <span className={`enemy${enemy.id >= 10 ? ' enemy-long' : ''}${selectedEnemy === enemy.id ? ' enemy-selected' : ''}`}>
                  E{enemy.id}
                </span>
              )}
              {(deadTok || deadEnemy) && (tok || enemy ? (
                <span className="corpse-mark">†</span>
              ) : (
                <span className={`${deadTok ? 'token' : 'enemy'} dead`}>†</span>
              ))}
            </button>
          )
        })}
      </div>
      <EdgeLayer edges={map.edges} cols={map.cols} rows={map.rows} />
      {isMaster && mode === 'edit' && active === 'terrain' && EDGES.includes(picks.terrain) && (
        <div className="edge-hit" onClick={placeEdge} />
      )}
      </div>

      {mode === 'play' && (
        <>
          <div className="chips">
            {placed.filter((tk) => isMaster || tk.id === myToken).map((tk) => (
              <button
                key={tk.id}
                className="tool"
                aria-pressed={active === 'move' && selected === tk.id}
                disabled={tk.dead}
                onClick={() => {
                  setActive('move')
                  setSelected(tk.id)
                  setSelectedEnemy(null)
                  setFocus(tk.pos)
                }}
              >
                <span className="swatch round" style={{ background: TOKEN_COLORS[tk.id] }}>{tk.id + 1}</span>
                Jugador {tk.id + 1}
              </button>
            ))}
          </div>
          {isMaster && <div className="chips enemy-chips">
            {placedEnemies.map((enemy) => (
              <button
                key={enemy.id}
                className="tool"
                aria-pressed={active === 'move' && selectedEnemy === enemy.id}
                disabled={enemy.dead}
                onClick={() => {
                  setActive('move')
                  setSelected(null)
                  setSelectedEnemy(enemy.id)
                  setFocus(enemy.pos)
                }}
              >
                <span className="swatch round enemy-swatch">E{enemy.id}</span>
                Enemigo E{enemy.id}
              </button>
            ))}
          </div>}
        </>
      )}

      <div className="bar">
        {drops.map((k) => (
          <button
            key={k}
            className={`sel${active === k ? ' active' : ''}`}
            aria-expanded={open === k}
            onClick={() => setOpen(open === k ? null : k)}
          >
            <span className="sel-title">{TITLES[k]} ▾</span>
            <span className="sel-value">
              <Swatch kind={k} id={picks[k]} small />
              <span className="txt">{valueLabel[k]}</span>
            </span>
          </button>
        ))}
      </div>

      {open && (
        <div className="panel">
          {GROUPS[open].map((g) => (
            <section key={g.label}>
              <h2>{g.label}</h2>
              <div className="tools">
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    className="tool"
                    aria-pressed={picks[open] === it.id}
                    onClick={() => pick(open, it.id)}
                  >
                    <Swatch kind={open} id={it.id} />
                    {it.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="actions">
        {isMaster && mode === 'edit' && <button onClick={clearTerrain}>Limpiar terreno</button>}
        <button onClick={clearMods}>Limpiar modificadores</button>
      </div>
    </main>
  )
}
