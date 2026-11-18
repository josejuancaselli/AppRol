import { useEffect, useState } from 'react'
import {
  addDoc, arrayRemove, collection, deleteDoc, deleteField, doc, onSnapshot, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { Room } from './App.jsx'
import { COLS, ROWS, TOKEN_COLORS } from './terrains'

const newCode = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

const emptyMap = () => ({
  cols: COLS,
  rows: ROWS,
  cells: {},
  mods: {},
  edges: {},
  enemies: {},
  order: [],
  tokens: Object.fromEntries(TOKEN_COLORS.map((_, id) => [id, { pos: null, dead: false }])),
})

// documento de la sala -> campos de un mapa guardado
const snap = (r) => ({
  cols: r.cols,
  rows: r.rows,
  cells: r.cells ?? {},
  mods: r.mods ?? {},
  edges: r.edges ?? {},
  enemies: r.enemies ?? {},
  tokens: r.tokens ?? {},
  order: r.order ?? [],
  actualizado: Date.now(),
})

export default function Party({ id, user, onBack }) {
  const [p, setP] = useState(undefined)
  const [maps, setMaps] = useState([])
  const [name, setName] = useState('')
  const [open, setOpen] = useState('')
  const [inRoom, setInRoom] = useState(false)
  const [room, setRoom] = useState(undefined)
  const pref = doc(db, 'parties', id)
  const rref = doc(db, 'rooms', id)
  const mapsCol = collection(pref, 'maps')

  useEffect(() => onSnapshot(pref, (s) => setP(s.exists() ? s.data() : null), () => setP(null)), [id])
  useEffect(() => onSnapshot(mapsCol,
    (s) => setMaps(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setMaps([])), [id])
  useEffect(() => {
    if (!inRoom) return
    return onSnapshot(rref, (s) => setRoom(s.exists() ? s.data() : null), () => setRoom(null))
  }, [id, inRoom])
  useEffect(() => { if (room === null) setInRoom(false) }, [room])

  // el master libera las fichas de quienes ya no son miembros
  useEffect(() => {
    if (!p || !room || p.masterId !== user.uid) return
    const stale = Object.entries(room.claims ?? {})
      .filter(([, v]) => !p.memberIds.includes(v)).map(([k]) => ['claims.' + k, deleteField()])
    if (stale.length) updateDoc(rref, Object.fromEntries(stale)).catch(() => {})
  })

  const back = <button className="tool" onClick={onBack}>← Volver</button>
  if (p === undefined) return <main className="app lobby"><p>Cargando…</p></main>
  if (p === null || !p.memberIds.includes(user.uid)) {
    return (
      <main className="app lobby">
        <p>No sos miembro de esta party, o ya no existe</p>
        {back}
      </main>
    )
  }

  const me = user.uid
  const isOwner = p.ownerId === me
  const isMaster = p.masterId === me
  const err = (t) => (e) => alert(t + ': ' + e.code)
  const live = p.sesion?.estado === 'jugando'
  const roomUpdate = (f) => updateDoc(rref, f).catch(() => {})

  // al soltar se actualiza primero la sala (todavía somos master); al tomar, primero la party
  const setMaster = async (v) => {
    try {
      if (v === null && live) await roomUpdate({ master: null })
      await updateDoc(pref, { masterId: v })
      if (v !== null && live) await roomUpdate({ master: v })
    } catch (e) { alert('Master: ' + e.code) }
  }

  const leave = () => { setInRoom(false); setRoom(undefined) }

  // expulsar a otro (creador) o abandonar la party (uno mismo)
  const expel = async (uid) => {
    const msg = uid === me ? '¿Abandonar la party?' : `¿Expulsar a ${p.members[uid]?.nombre}?`
    if (!window.confirm(msg)) return
    try {
      await updateDoc(pref, {
        memberIds: arrayRemove(uid),
        ['members.' + uid]: deleteField(),
        ...(p.masterId === uid ? { masterId: null } : {}),
      })
      if (uid === me) onBack()
    } catch (e) { alert('Expulsar: ' + e.code) }
  }

  const removeParty = async () => {
    if (!window.confirm(`¿Borrar la party "${p.nombre}" y todos sus mapas? No se puede deshacer.`)) return
    try {
      await Promise.all(maps.map((m) => deleteDoc(doc(mapsCol, m.id))))
      await deleteDoc(rref)
      await deleteDoc(doc(db, 'invites', p.inviteCode))
      await deleteDoc(pref)
      onBack()
    } catch (e) { alert('Borrar: ' + e.code) }
  }

  const newLink = () => {
    const code = newCode()
    const b = writeBatch(db)
    b.delete(doc(db, 'invites', p.inviteCode))
    b.set(doc(db, 'invites', code),
      { partyId: id, ownerId: me, nombre: p.nombre, creador: p.members[me]?.nombre })
    b.update(pref, { inviteCode: code })
    b.commit().then(() => alert('El link anterior ya no sirve. Copiá el nuevo.'), err('Link'))
  }

  const start = async (m) => {
    if (live && !window.confirm('Ya hay una sesión en juego. ¿Reemplazarla?')) return
    const { id: mapId, nombre, actualizado, players, ...d } = m
    try {
      await setDoc(rref, { ...d, order: d.order ?? [], abierta: false, master: me, claims: {} })
      await updateDoc(pref, { sesion: { estado: 'jugando', mapId, mapa: nombre } })
      setInRoom(true)
    } catch (e) { alert('Abrir: ' + e.code) }
  }

  const save = () => {
    if (!window.confirm(`¿Sobrescribir "${p.sesion.mapa}" con el estado actual?`)) return
    updateDoc(doc(mapsCol, p.sesion.mapId), snap(room)).then(() => alert('Guardado'), err('Guardar'))
  }
  const saveAs = () => {
    const n = window.prompt('Nombre del mapa')?.trim()
    if (n) addDoc(mapsCol, { nombre: n, ...snap(room) }).then(() => alert('Guardado'), err('Guardar'))
  }
  const end = async () => {
    try {
      if (window.confirm(`¿Guardar los cambios en "${p.sesion.mapa}" antes de terminar?`)) {
        await updateDoc(doc(mapsCol, p.sesion.mapId), snap(room))
      } else if (!window.confirm('¿Terminar sin guardar? Se pierden los cambios')) return
      await deleteDoc(rref)
      await updateDoc(pref, { sesion: { estado: 'lobby', mapId: null } })
    } catch (e) { alert('Terminar: ' + e.code) }
  }

  const create = () => {
    const nombre = name.trim()
    if (!nombre) return
    setName('')
    addDoc(mapsCol, { nombre, actualizado: Date.now(), ...emptyMap() }).catch(err('Crear'))
  }
  const rename = (m) => {
    const n = window.prompt('Nombre', m.nombre)?.trim()
    if (n) updateDoc(doc(mapsCol, m.id), { nombre: n, actualizado: Date.now() })
  }
  const duplicate = ({ id: _id, ...m }) =>
    addDoc(mapsCol, { ...m, nombre: m.nombre + ' (copia)', actualizado: Date.now() })
  const remove = (m) => window.confirm(`¿Borrar "${m.nombre}"?`) && deleteDoc(doc(mapsCol, m.id))

  if (inRoom && room) {
    return (
      <Room code={id} data={room} onLeave={leave} client={me} title={p.nombre}
        banner={isMaster ? (
          <div className="tools">
            <span>
              {room.abierta ? '● Sala abierta' : '○ Sala cerrada'} · fichas tomadas: {Object.keys(room.claims ?? {}).length}
            </span>
            <button className="tool" onClick={() => updateDoc(rref, { abierta: !room.abierta })}>
              {room.abierta ? 'Cerrar sala' : 'Abrir sala'}
            </button>
          </div>
        ) : null}
        menuExtra={isMaster ? (
          <>
            <button onClick={save}>Guardar</button>
            <button onClick={saveAs}>Guardar como…</button>
            <button onClick={end}>Terminar sesión</button>
          </>
        ) : <></>} />
    )
  }

  const inviteLink = `${location.origin}${location.pathname}?party=${id}&inv=${p.inviteCode}`

  return (
    <main className="app lobby">
      <header className="top"><h1>{p.nombre}</h1></header>
      {back}

      <h2>Sesión</h2>
      {live ? (
        <button className="tool" onClick={() => setInRoom(true)}>Entrar a la sala · {p.sesion.mapa}</button>
      ) : <p>En espera</p>}

      <h2>Miembros ({p.memberIds.length}/{p.max})</h2>
      {Object.entries(p.members).map(([uid, m]) => (
        <div className="tools" key={uid}>
          <span>
            {m.nombre}{uid === p.ownerId ? ' · creador' : ''}{uid === p.masterId ? ' · master' : ''}
          </span>
          {isOwner && uid !== me && <button className="tool" onClick={() => expel(uid)}>Expulsar</button>}
          {!isOwner && uid === me && <button className="tool" onClick={() => expel(uid)}>Abandonar</button>}
        </div>
      ))}
      {isOwner && (
        <div className="tools">
          <button className="tool" onClick={() =>
            navigator.clipboard.writeText(inviteLink).then(
              () => alert('Link copiado'),
              () => window.prompt('Copiá el link', inviteLink))}>
            Copiar link de invitación
          </button>
          <button className="tool" onClick={newLink}>Regenerar link</button>
        </div>
      )}

      {isMaster ? (
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
            {isMaster && <button className="tool" onClick={() => start(m)}>Abrir</button>}
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

      {isOwner && <button className="tool" onClick={removeParty}>Borrar party</button>}
    </main>
  )
}