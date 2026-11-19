import { useEffect, useRef, useState } from 'react'
import { doc, updateDoc, deleteField } from 'firebase/firestore'
import { db } from './firebase'
import { alertBox } from './ui'
import { KIND_ORDER, KIND_LABEL, TERRAINS, TERRAIN_BY_ID, TOKEN_COLORS, tokenStyle } from './terrains'
import { MODIFIERS, MOD_GROUPS, MOD_BY_ID } from './modifiers'
import TurnBar from './Turns'
import { EDGES, EDGE_LABEL, EdgeLayer, nearestEdge, edgeInside } from './Edges'
import { fromDoc, diff } from './roomData'
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
      { id: 'boss', label: 'Agregar jefe' },
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
  if (kind === 'enemy') return <span className={`swatch round enemy-swatch${id === 'boss' ? ' boss' : ''}${sm}`}>{id === 'boss' ? 'J' : 'E'}</span>
  return <span className={`swatch round${sm}`} style={tokenStyle(id)}>{id + 1}</span>
}

export function Room({ code, data, onLeave, client = CLIENT, menuExtra, banner, title }) {
  const roomRef = doc(db, 'rooms', code)
  const isMaster = data.master === client
  const placed = (id) => data.tokens?.[id]?.pos != null
  const mine = Object.keys(data.claims ?? {}).find((k) => data.claims[k] === client && placed(k))
  const myToken = mine === undefined ? null : Number(mine)

  // el master libera las fichas tomadas cuyo jugador fue borrado del mapa
  useEffect(() => {
    if (!isMaster) return
    const stale = Object.keys(data.claims ?? {}).filter((k) => !placed(k))
    if (stale.length) {
      updateDoc(roomRef, Object.fromEntries(stale.map((k) => ['claims.' + k, deleteField()]))).catch(() => {})
    }
  })

  if (!isMaster && myToken === null) {
    const ids = TOKEN_COLORS.map((_, id) => id).filter(placed)
    const claim = (id) => updateDoc(roomRef, { ['claims.' + id]: client })
      .catch((e) => alertBox('No se pudo tomar la ficha: ' + e.code, 'Error'))
    const wait = data.abierta === false
      ? ['Esperando al master', 'La sala todavía no está abierta. Esta pantalla se actualiza sola.']
      : ids.length === 0
        ? ['Todavía no hay fichas', 'El master no colocó fichas de jugador en el mapa.']
        : null
    return (
      <main className="ui-page">
        <div className="ui-screen ui-top">
          <header className="ui-bar" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <button className="pt-icon pt-back" aria-label="Salir de la sala" onClick={onLeave}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 4l-6 6 6 6" /></svg>
            </button>
            <h1 className="ui-h1 pt-title">Elegí tu ficha</h1>
          </header>
          {wait ? (
            <div className="ui-empty">
              <h2 className="ui-h2">{wait[0]}</h2>
              <p className="ui-sub">{wait[1]}</p>
            </div>
          ) : (
            <>
              <p className="ui-sub">{title ? `Party ${title}. ` : ''}Tocá una ficha libre para jugar con ella.</p>
              <div className="sf-grid">
                {ids.map((id) => {
                  const taken = !!data.claims?.[id]
                  return (
                    <button key={id} className="sf-tok" disabled={taken} onClick={() => claim(id)}>
                      <span className="sf-dot" style={tokenStyle(id)}>{id + 1}</span>
                      <span className="sf-name">Jugador {id + 1}</span>
                      <span className="sf-state">{taken ? 'Tomada' : 'Libre'}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </main>
    )
  }
  return <Board roomRef={roomRef} code={code} data={data} isMaster={isMaster} myToken={myToken}
    onLeave={onLeave} menuExtra={menuExtra} banner={banner} title={title} />
}

function Board({ roomRef, code, data, isMaster, myToken, onLeave, menuExtra, banner, title }) {
  const map = fromDoc(data)
  const [mode, setMode] = useState(isMaster ? 'edit' : 'play')
  const [picks, setPicks] = useState({ terrain: 'rock', mod: 'fire', token: 0, enemy: 'add' })
  const [active, setActive] = useState(isMaster ? 'terrain' : 'move')
  const [open, setOpen] = useState(null)
  const [selected, setSelected] = useState(myToken)
  const [selectedEnemy, setSelectedEnemy] = useState(null)
  const [focus, setFocus] = useState(null)
  const [menu, setMenu] = useState(false)
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
      } else if ((picks.enemy === 'add' || picks.enemy === 'boss') && !enemy && !tokenAt(i)) {
        const nextId = map.enemies.reduce((max, item) => Math.max(max, item.id), 0) + 1
        change({ ...map, enemies: [...map.enemies, { id: nextId, pos: i, boss: picks.enemy === 'boss' }] })
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

  const valueLabel = {
    terrain: EDGE_LABEL[picks.terrain] ?? TERRAIN_BY_ID[picks.terrain].label,
    mod: picks.mod === 'none' ? 'Quitar' : MOD_BY_ID[picks.mod].label,
    token: picks.token === 'none' ? 'Quitar' : `Jugador ${picks.token + 1}`,
    enemy: { none: 'Quitar enemigo', boss: 'Agregar jefe' }[picks.enemy] ?? 'Agregar enemigo',
  }

  const placed = map.tokens.filter((t) => t.pos !== null)
  const placedEnemies = map.enemies.filter((e) => e.pos !== null)

  return (
    <main className="app">
      <header className="top">
        <div className="menu-wrap">
          <button className="menu-btn" onClick={() => setMenu(!menu)}>Sala {title ?? code} ⋯</button>
          {menu && (
            <div className="menu">
              {menuExtra ? (
                <div style={{ display: 'contents' }} onClick={() => setMenu(false)}>{menuExtra}</div>
              ) : (
                <button onClick={() => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}?sala=${code}`); setMenu(false) }}>Copiar link</button>
              )}
              {!isMaster && <button onClick={() => updateDoc(roomRef, { ['claims.' + myToken]: deleteField() })}>Cambiar ficha</button>}
              <button onClick={onLeave}>Salir</button>
            </div>
          )}
        </div>
        {isMaster && (
          <div className="modes">
            <button aria-pressed={mode === 'edit'} onClick={() => switchMode('edit')}>Editar</button>
            <button aria-pressed={mode === 'play'} onClick={() => switchMode('play')}>Jugar</button>
          </div>
        )}
      </header>

      {banner}

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

      <TurnBar map={map} order={data.order ?? []} isMaster={isMaster} onChange={(o) => updateDoc(roomRef, { order: o })} />
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
                    style={tokenStyle(tok.id)}
                  >
                    {tok.id + 1}
                  </span>
                )}
                {enemy && (
                  <span className={`enemy${enemy.boss ? ' boss' : ''}${enemy.id >= 10 ? ' enemy-long' : ''}${selectedEnemy === enemy.id ? ' enemy-selected' : ''}`}>
                    {enemy.boss ? 'J' : 'E'}{enemy.id}
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
        <div className="cols">
          <div className="cc">
            {placed.filter((tk) => isMaster || tk.id === myToken).map((tk) => (
              <button
                key={tk.id}
                className="pc"
                aria-label={`Jugador ${tk.id + 1}`}
                aria-pressed={active === 'move' && selected === tk.id}
                disabled={tk.dead}
                onClick={() => {
                  setActive('move')
                  setSelected(tk.id)
                  setSelectedEnemy(null)
                  setFocus(tk.pos)
                  setOpen(null)
                }}
              >
                <span className="swatch round" style={tokenStyle(tk.id)}>{tk.id + 1}</span>
              </button>
            ))}
          </div>
          {isMaster ? (
            <div className="cc">
              {placedEnemies.map((enemy) => (
                <button
                  key={enemy.id}
                  className="pc"
                  aria-label={`${enemy.boss ? 'Jefe J' : 'Enemigo E'}${enemy.id}`}
                  aria-pressed={active === 'move' && selectedEnemy === enemy.id}
                  disabled={enemy.dead}
                  onClick={() => {
                    setActive('move')
                    setSelected(null)
                    setSelectedEnemy(enemy.id)
                    setFocus(enemy.pos)
                    setOpen(null)
                  }}
                >
                  <span className={`swatch round enemy-swatch${enemy.boss ? ' boss' : ''}`}>{enemy.boss ? 'J' : 'E'}{enemy.id}</span>
                </button>
              ))}
            </div>
          ) : <div />}
          <div className="modcol">
            <button
              className={`sel${active === 'mod' ? ' active' : ''}`}
              aria-expanded={open === 'mod'}
              onClick={() => setOpen(open === 'mod' ? null : 'mod')}
            >
              <span className="sel-title">Modificadores {open === 'mod' ? '▴' : '▾'}</span>
              <span className="sel-value">
                <Swatch kind="mod" id={picks.mod} small />
                <span className="txt">{valueLabel.mod}</span>
              </span>
            </button>
          </div>
          {open === 'mod' && (
            <div className="modpan">
              {GROUPS.mod.map((g) => (
                <section key={g.label}>
                  <h2>{g.label}</h2>
                  <div className="tools">
                    {g.items.map((it) => (
                      <button key={it.id} className="tool" aria-pressed={picks.mod === it.id} onClick={() => pick('mod', it.id)}>
                        <Swatch kind="mod" id={it.id} />
                        {it.label}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'edit' && (
        <>
          <div className="bar">
            {['terrain', 'mod', 'token', 'enemy'].map((k) => (
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
                      <button key={it.id} className="tool" aria-pressed={picks[open] === it.id} onClick={() => pick(open, it.id)}>
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
            <button onClick={clearTerrain}>Limpiar terreno</button>
          </div>
        </>
      )}
    </main>
  )
}