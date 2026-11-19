import { deleteField } from 'firebase/firestore'
import { COLS, ROWS, TERRAIN_BY_ID, TOKEN_COLORS } from './terrains'
import { MOD_BY_ID } from './modifiers'

// En Firestore el mapa se guarda "disperso" (solo celdas con terreno o modificador)
// y con claves por índice, para poder actualizar una sola celda sin pisar a los demás.
export const sparse = (arr, empty) =>
  Object.fromEntries(arr.map((v, i) => [i, v]).filter(([, v]) => v !== empty))

export function sampleMap() {
  const cells = Array(COLS * ROWS).fill('grass')
  const mods = Array(COLS * ROWS).fill(null)
  const put = (arr, id, list) => list.forEach(([r, c]) => {
    if (r < ROWS && c < COLS) arr[r * COLS + c] = id
  })
  for (let r = 0; r < ROWS; r++) put(cells, 'river', [[r, r < 4 ? 8 : r < 8 ? 7 : 6]])
  for (let r = 9; r <= 11; r++) for (let c = 1; c <= 3; c++) put(cells, 'water', [[r, c]])
  for (let c = 1; c <= 5; c++) put(cells, 'cliff', [[3, c]])
  put(cells, 'tree', [[1, 1], [1, 3], [2, 2], [5, 10], [6, 9], [7, 10], [12, 9], [12, 10], [13, 9]])
  put(cells, 'rock', [[6, 3], [6, 4], [7, 3], [4, 10], [10, 8], [12, 2]])
  put(cells, 'mud', [[7, 5], [7, 6], [8, 5]])
  put(cells, 'brush', [[9, 10], [9, 11], [10, 10], [10, 11]])
  put(cells, 'vines', [[1, 5], [2, 5]])
  put(cells, 'sand', [[8, 10], [8, 11], [7, 11]])
  put(cells, 'lava', [[0, 10], [0, 11], [1, 11]])
  put(mods, 'fire', [[5, 3], [5, 4]])
  put(mods, 'oil', [[4, 5], [5, 5]])
  put(mods, 'ice', [[11, 4], [12, 4]])
  put(mods, 'fog', [[7, 8], [8, 8]])
  const tokens = TOKEN_COLORS.map((color, id) => ({
    id,
    color,
    pos: id < 3 ? 13 * COLS + 3 + id : null,
  }))
  return { cols: COLS, rows: ROWS, cells, mods, tokens, enemies: [], edges: {} }
}

// mapa local -> documento de Firestore
export const toDoc = (m, master) => ({
  cols: m.cols,
  rows: m.rows,
  master,
  claims: {},
  cells: sparse(m.cells, 'grass'),
  mods: sparse(m.mods, null),
  tokens: Object.fromEntries(m.tokens.map((t) => [t.id, { pos: t.pos, dead: !!t.dead }])),
  enemies: {},
  edges: {},
})

// documento de Firestore -> mapa local (el mismo formato que usa la pantalla)
export const fromDoc = (d) => {
  const n = d.cols * d.rows
  return {
    cols: d.cols,
    rows: d.rows,
    // un terreno o modificador que ya no existe se muestra como pasto / sin modificador
    cells: Array.from({ length: n }, (_, i) => (Object.hasOwn(TERRAIN_BY_ID, d.cells?.[i]) ? d.cells[i] : 'grass')),
    mods: Array.from({ length: n }, (_, i) => (Object.hasOwn(MOD_BY_ID, d.mods?.[i]) ? d.mods[i] : null)),
    tokens: TOKEN_COLORS.map((color, id) => ({
      id,
      color,
      pos: d.tokens?.[id]?.pos ?? null,
      dead: !!d.tokens?.[id]?.dead,
    })),
    edges: d.edges ?? {},
    enemies: Object.entries(d.enemies ?? {}).map(([id, e]) => ({
      id: Number(id),
      pos: e.pos ?? null,
      dead: !!e.dead,
      boss: !!e.boss,
    })),
  }
}

// Diferencias entre dos mapas locales como actualización por campos de Firestore
export const diff = (a, b) => {
  const u = {}
  if (a.cols !== b.cols || a.rows !== b.rows) {
    u.cols = b.cols
    u.rows = b.rows
    u.cells = sparse(b.cells, 'grass')
    u.mods = sparse(b.mods, null)
  } else {
    b.cells.forEach((v, i) => {
      if (v !== a.cells[i]) u[`cells.${i}`] = v === 'grass' ? deleteField() : v
    })
    b.mods.forEach((v, i) => {
      if (v !== a.mods[i]) u[`mods.${i}`] = v ?? deleteField()
    })
  }
  const ea = a.edges ?? {}
  const eb = b.edges ?? {}
  Object.keys(eb).forEach((k) => { if (ea[k] !== eb[k]) u[`edges.${k}`] = eb[k] })
  Object.keys(ea).forEach((k) => { if (!(k in eb)) u[`edges.${k}`] = deleteField() })
  b.tokens.forEach((t, i) => {
    const o = a.tokens[i]
    if (t.pos !== o.pos || !!t.dead !== !!o.dead) u[`tokens.${t.id}`] = { pos: t.pos, dead: !!t.dead }
  })
  b.enemies.forEach((e) => {
    const o = a.enemies.find((x) => x.id === e.id)
    if (!o || e.pos !== o.pos || !!e.dead !== !!o.dead) u[`enemies.${e.id}`] = { pos: e.pos, dead: !!e.dead, boss: !!e.boss }
  })
  return u
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newRoomCode = () =>
  Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
