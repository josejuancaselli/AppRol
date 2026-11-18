import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { COLS, ROWS, TOKEN_COLORS } from './terrains'

const emptyMap = () => ({
  cols: COLS,
  rows: ROWS,
  cells: {},
  mods: {},
  edges: {},
  enemies: {},
  tokens: Object.fromEntries(TOKEN_COLORS.map((_, id) => [id, { pos: null, dead: false }])),
})

export default function Party({ id, user, onBack }) {
  const [p, setP] = useState(undefined)
  const [maps, setMaps] = useState([])
  const [name, setName] = useState('')
  const [open, setOpen] = useState('')
  const pref = doc(db, 'parties', id)
  const mapsCol = collection(pref, 'maps')

  useEffect(() => onSnapshot(pref, (s) => setP(s.exists() ? s.data() : null)), [id])
  useEffect(() => onSnapshot(mapsCol,
    (s) => setMaps(s.docs.map((d) => ({ id: d.id, ...d.data() })))), [id])

  const back = <button className="tool" onClick={onBack}>← Volver</button>
  if (p === undefined) return <main className="app lobby"><p>Cargando…</p></main>
  if (p === null || !p.memberIds.includes(user.uid)) {
    return (
      <main className="app lobby">
        <p>{p ? 'No sos miembro de esta party' : 'La party no existe'}</p>
        {back}
      </main>
    )
  }

  const me = user.uid
  const setMaster = (v) => updateDoc(pref, { masterId: v })
  const inviteLink = `${location.origin}${location.pathname}?party=${id}&inv=${p.inviteCode}`

  const create = () => {
    const nombre = name.trim()
    if (!nombre) return
    setName('')
    addDoc(mapsCol, { nombre, actualizado: Date.now(), ...emptyMap() })
      .catch((e) => alert('Crear: ' + e.code))
  }
  const rename = (m) => {
    const n = window.prompt('Nombre', m.nombre)?.trim()
    if (n) updateDoc(doc(mapsCol, m.id), { nombre: n, actualizado: Date.now() })
  }
  const duplicate = ({ id: _id, ...m }) =>
    addDoc(mapsCol, { ...m, nombre: m.nombre + ' (copia)', actualizado: Date.now() })
  const remove = (m) => window.confirm(`¿Borrar "${m.nombre}"?`) && deleteDoc(doc(mapsCol, m.id))

  return (
    <main className="app lobby">
      <header className="top"><h1>{p.nombre}</h1></header>
      {back}

      <h2>Miembros ({p.memberIds.length}/{p.max})</h2>
      {Object.entries(p.members).map(([uid, m]) => (
        <p key={uid}>
          {m.nombre}{uid === p.ownerId ? ' · creador' : ''}{uid === p.masterId ? ' · master' : ''}
        </p>
      ))}
      {p.ownerId === me && (
        <button className="tool" onClick={() =>
          navigator.clipboard.writeText(inviteLink).then(
            () => alert('Link copiado'),
            () => window.prompt('Copiá el link', inviteLink))}>
          Copiar link de invitación
        </button>
      )}

      {p.masterId === me ? (
        <button className="tool" onClick={() => setMaster(null)}>Soltar master</button>
      ) : (
        <button className="tool"
          onClick={() => (!p.masterId || window.confirm('¿Forzar master?')) && setMaster(me)}>
          {p.masterId ? 'Forzar master' : 'Tomar master'}
        </button>
      )}

      <h2>Mapas</h2>
      {[...maps].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((m) => (
        <div key={m.id}>
          <div className="tools">
            <span>{m.nombre}</span>
            <button className="tool" onClick={() => setOpen(open === m.id ? '' : m.id)}>⋯</button>
          </div>
          {open === m.id && (
            <div className="tools">
              <button className="tool" onClick={() => rename(m)}>Renombrar</button>
              <button className="tool" onClick={() => duplicate(m)}>Duplicar</button>
              <button className="tool" onClick={() => remove(m)}>Borrar</button>
            </div>
          )}
        </div>
      ))}
      <div className="tools">
        <input className="room-input" placeholder="Nombre del mapa" value={name}
          onChange={(e) => setName(e.target.value)} />
        <button className="tool" disabled={!name.trim()} onClick={create}>Nuevo mapa</button>
      </div>
    </main>
  )
}