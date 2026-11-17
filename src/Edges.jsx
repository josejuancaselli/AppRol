// Aberturas sobre las líneas de la grilla. Clave: "h_fila_col" (borde superior de la celda)
// o "v_fila_col" (borde izquierdo). Se dibujan en unidades de celda, siempre como borde horizontal.
export const EDGES = ['wall', 'door', 'window', 'stairs', 'none']
export const EDGE_LABEL = { wall: 'Pared', door: 'Puerta', window: 'Ventana', stairs: 'Escalera', none: 'Nada' }

const INK = '#2b2d31'
const SHAPES = {
  wall: <path d="M0 0H1" stroke={INK} strokeWidth=".16" strokeLinecap="square" />,
  door: (
    <>
      <path d="M0 0H.14M.86 0H1" stroke={INK} strokeWidth=".16" />
      <rect x=".14" y="-.1" width=".72" height=".2" fill="#c98a4b" stroke="#5a3a18" strokeWidth=".04" />
    </>
  ),
  window: (
    <>
      <path d="M0 0H1" stroke={INK} strokeWidth=".16" strokeLinecap="square" />
      <path d="M.1 0H.9" stroke="#8fd8ff" strokeWidth=".07" />
    </>
  ),
  stairs: (
    <>
      <rect x="0" y="-.26" width="1" height=".52" fill="#e3c88f" stroke="#8a6a3a" strokeWidth=".03" />
      <path d="M.2 -.26V.26M.4 -.26V.26M.6 -.26V.26M.8 -.26V.26" stroke="#8a6a3a" strokeWidth=".05" />
    </>
  ),
}

export function EdgeLayer({ edges, cols, rows }) {
  return (
    <svg className="edges" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none">
      {Object.entries(edges).map(([k, t]) => {
        const [o, r, c] = k.split('_')
        return (
          <g key={k} transform={o === 'h' ? `translate(${c} ${r})` : `matrix(0 1 1 0 ${c} ${r})`}>
            {SHAPES[t]}
          </g>
        )
      })}
    </svg>
  )
}

// Borde de grilla más cercano a un punto (x, y en unidades de celda)
export function nearestEdge(x, y, cols, rows) {
  const fx = x - Math.floor(x)
  const fy = y - Math.floor(y)
  const cl = (v, max) => Math.max(0, Math.min(max, v))
  return Math.min(fx, 1 - fx) < Math.min(fy, 1 - fy)
    ? `v_${cl(Math.floor(y), rows - 1)}_${cl(Math.round(x), cols)}`
    : `h_${cl(Math.round(y), rows)}_${cl(Math.floor(x), cols - 1)}`
}

export const edgeInside = (k, cols, rows) => {
  const [o, r, c] = k.split('_')
  return o === 'h' ? +r <= rows && +c < cols : +r < rows && +c <= cols
}
