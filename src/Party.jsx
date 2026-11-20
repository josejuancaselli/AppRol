import { useEffect, useState } from 'react'
import {
  addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, updateDoc, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { Room } from './App.jsx'
import { COLS, ROWS, TOKEN_COLORS } from './terrains'
import Account from './Account'
import { alertBox, confirmBox, promptBox, choose } from './ui'
import { report } from './errors.js'
import { claimMaster, deleteParty, endSession, releaseMaster, removeMember, startSession } from './partyOps.js'

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

const HUES = ['#5b7fa6', '#6a9a6e', '#a6685b', '#9a7bb0', '#4fa3a5', '#b58a5a']
const hue = (uid) => HUES[[...uid].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]

const Crown = ({ size = 20, color = '#1b1407' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={color} aria-hidden="true"><path d="M3 15l-1-9 4 3 4-6 4 6 4-3-1 9z" /></svg>
)
const Dots = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="16" cy="10" r="1.6" />
  </svg>
)
const Plus = ({ size = 22, color }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
)

export default function Party({ id, user, onBack }) {
  const [p, setP] = useState(undefined)
  const [maps, setMaps] = useState([])
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

  const backBtn = (
    <button className="pt-icon pt-back" aria-label="Volver" onClick={onBack}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 4l-6 6 6 6" /></svg>
    </button>
  )
  if (p === undefined) {
    return <main className="ui-page"><div className="ui-screen ui-top"><p className="ui-sub">Cargando…</p></div></main>
  }
  if (p === null || !p.memberIds.includes(user.uid)) {
    return (
      <main className="ui-page">
        <div className="ui-screen ui-top">
          <p className="ui-sub">No sos miembro de esta party, o ya no existe.</p>
          <button className="ui-btn ui-btn-secondary" onClick={onBack}>Volver</button>
        </div>
      </main>
    )
  }

  const me = user.uid
  const isOwner = p.ownerId === me
  const isMaster = p.masterId === me
  const live = p.sesion?.estado === 'jugando'
  const err = report

  // Siempre hay un solo master: tomar, soltar y forzar son transacciones (ver partyOps.js)
  const takeMaster = async () => {
    const current = p.masterId
    if (current) {
      const quien = p.members[current]?.nombre ?? 'quien lo tiene'
      if (!(await confirmBox(`Vas a quitarle el rol de master a ${quien}.`, { title: 'Forzar master', ok: 'Forzar' }))) return
    }
    // Si nadie lo tenía y alguien lo toma justo antes, la transacción falla y avisa
    claimMaster(id, me, !!current).catch(err('Master'))
  }

  const leave = () => { setInRoom(false); setRoom(undefined) }

  // expulsar a otro (creador) o abandonar la party (uno mismo)
  const expel = async (uid) => {
    const ok = uid === me
      ? await confirmBox('Vas a salir de la party.', { title: 'Abandonar party', ok: 'Abandonar', danger: true })
      : await confirmBox(`${p.members[uid]?.nombre} deja de ser miembro de la party.`, { title: 'Expulsar', ok: 'Expulsar', danger: true })
    if (!ok) return
    try {
      await removeMember(id, uid) // si era el master, también libera el puesto
      if (uid === me) onBack()
    } catch (e) { err('Expulsar')(e) }
  }

  const removeParty = async () => {
    if (!(await confirmBox(`Se borra "${p.nombre}" con todos sus mapas. No se puede deshacer.`,
      { title: 'Borrar party', ok: 'Borrar', danger: true }))) return
    try {
      await deleteParty(id, p.inviteCode, maps.map((m) => doc(mapsCol, m.id)))
      onBack()
    } catch (e) { err('Borrar')(e) }
  }

  const newLink = () => {
    const code = newCode()
    const b = writeBatch(db)
    b.delete(doc(db, 'invites', p.inviteCode))
    b.set(doc(db, 'invites', code),
      { partyId: id, ownerId: me, nombre: p.nombre, creador: p.members[me]?.nombre })
    b.update(pref, { inviteCode: code })
    b.commit().then(() => alertBox('El link anterior ya no sirve. Usá "Invitar" para copiar el nuevo.'), err('Link'))
  }

  const inviteLink = `${location.origin}${location.pathname}?party=${id}&inv=${p.inviteCode}`
  const invite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      alertBox('Link copiado. Pasáselo a quien quieras invitar.')
    } catch {
      promptBox('Copiá el link', { title: 'Link de invitación', value: inviteLink, ok: 'Cerrar' })
    }
  }

  const manage = async () => {
    const v = await choose('Gestionar party',
      'Regenerar link: el link anterior deja de funcionar.\nBorrar party: borra la party y todos sus mapas.',
      [
        { label: 'Regenerar link de invitación', value: 'link', kind: 'secondary' },
        { label: 'Borrar party', value: 'del', kind: 'danger' },
        { label: 'Cerrar', value: false, kind: 'ghost' },
      ])
    if (v === 'link') newLink()
    if (v === 'del') removeParty()
  }

  const memberMenu = async (uid) => {
    const v = await choose(p.members[uid]?.nombre, null, [
      { label: 'Expulsar de la party', value: 'kick', kind: 'danger' },
      { label: 'Cerrar', value: false, kind: 'ghost' },
    ])
    if (v === 'kick') expel(uid)
  }

  const start = async (m) => {
    if (live && !(await confirmBox('Ya hay una sesión en juego. ¿Reemplazarla?', { title: 'Abrir mapa', ok: 'Reemplazar', danger: true }))) return
    const { id: mapId, nombre, actualizado, players, ...d } = m
    try {
      await startSession(id, me, d, mapId, nombre) // solo si sigo siendo el master
      setInRoom(true)
    } catch (e) { err('Abrir')(e) }
  }

  const save = async () => {
    if (!(await confirmBox(`Se sobrescribe "${p.sesion.mapa}" con el estado actual.`, { title: 'Guardar', ok: 'Guardar' }))) return
    updateDoc(doc(mapsCol, p.sesion.mapId), snap(room)).then(() => alertBox('Guardado'), err('Guardar'))
  }
  const saveAs = async () => {
    const n = (await promptBox('Nombre del mapa', { title: 'Guardar como', ok: 'Guardar' }))?.trim()
    if (n) addDoc(mapsCol, { nombre: n, ...snap(room) }).then(() => alertBox('Guardado'), err('Guardar'))
  }
  const end = async () => {
    const v = await choose('Terminar sesión', `¿Guardar los cambios en "${p.sesion.mapa}" antes de terminar?`, [
      { label: 'Guardar y terminar', value: 'save', kind: 'primary' },
      { label: 'Terminar sin guardar', value: 'discard', kind: 'danger' },
      { label: 'Cancelar', value: false, kind: 'ghost' },
    ])
    if (!v) return
    try {
      // guardar el mapa, borrar la sala y volver al lobby: todo junto o nada
      await endSession(id, p.sesion.mapId, v === 'save' ? snap(room) : null)
    } catch (e) { err('Terminar')(e) }
  }

  const create = async () => {
    const nombre = (await promptBox('Nombre del mapa', { title: 'Nuevo mapa', ok: 'Crear' }))?.trim()
    if (nombre) addDoc(mapsCol, { nombre, actualizado: Date.now(), ...emptyMap() }).catch(err('Crear'))
  }
  const rename = async (m) => {
    const n = (await promptBox('', { title: 'Renombrar', value: m.nombre, ok: 'Guardar' }))?.trim()
    if (n) updateDoc(doc(mapsCol, m.id), { nombre: n, actualizado: Date.now() }).catch(err('Renombrar'))
  }
  const duplicate = ({ id: _id, ...m }) =>
    addDoc(mapsCol, { ...m, nombre: m.nombre + ' (copia)', actualizado: Date.now() }).catch(err('Duplicar'))
    // El mapa que se está jugando no se puede borrar mientras la sesión esté abierta
  const playingId = live ? p.sesion.mapId : null
  const remove = async (m) => {
    if (m.id === playingId) {
      alertBox('Terminá la sesión para poder borrarlo.', 'Mapa en juego')
      return
    }
    if (await confirmBox(`Se borra "${m.nombre}".`, { title: 'Borrar mapa', ok: 'Borrar', danger: true })) {
      deleteDoc(doc(mapsCol, m.id)).catch(err('Borrar'))
    }
  }
  const mapMenu = async (m) => {
    const playing = m.id === playingId
    const v = await choose(m.nombre,
      playing ? 'Este mapa se está jugando: terminá la sesión para poder borrarlo.' : null,
      [
        { label: 'Renombrar', value: 'ren', kind: 'secondary' },
        { label: 'Duplicar', value: 'dup', kind: 'secondary' },
        ...(playing ? [] : [{ label: 'Borrar mapa', value: 'del', kind: 'danger' }]),
        { label: 'Cerrar', value: false, kind: 'ghost' },
      ])
    if (v === 'ren') rename(m)
    if (v === 'dup') duplicate(m)
    if (v === 'del') remove(m)
  }

  if (inRoom && room) {
    return (
      <Room code={id} data={{ ...room, master: p.masterId }} onLeave={leave} client={me} title={p.nombre}
        banner={isMaster ? (
          <button className="sa-room" role="switch" aria-checked={!!room.abierta}
            onClick={() => updateDoc(rref, { abierta: !room.abierta }).catch(err('Sala'))}>
            <span className="ui-dot" />
            <span>
              {room.abierta ? 'Sala abierta' : 'Sala cerrada'}
              <small>fichas tomadas: {Object.keys(room.claims ?? {}).length}</small>
            </span>
          </button>
        ) : null}
        menuExtra={isMaster ? (
          <>
            <button onClick={save}>Guardar</button>
            <button onClick={saveAs}>Guardar como…</button>
            <button className="danger" onClick={end}>Terminar sesión</button>
          </>
        ) : <></>} />
    )
  }

  const masterName = p.members[p.masterId]?.nombre
  const members = Object.entries(p.members)
    .sort(([a], [b]) => (b === p.ownerId) - (a === p.ownerId))
  const sorted = [...maps].sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <main className="ui-page">
      <div className="ui-screen ui-top" style={{ gap: 28 }}>
        <header className="ui-bar" style={{ justifyContent: 'flex-start', gap: 8 }}>
          {backBtn}
          <h1 className="ui-h1 pt-title">{p.nombre}</h1>
          {isOwner && <button className="pt-icon" aria-label="Gestionar party" onClick={manage}><Dots /></button>}
          <Account user={user} reset={onBack} />
        </header>

        <section className={`pt-session${live ? ' pt-live' : ''}`}>
          <div className="ui-stack ui-gap-sm" style={{ gap: 6 }}>
            <span className="pt-label">
              {live && <span className="ui-dot" />}{live ? 'Sesión en juego' : 'Sesión'}
            </span>
            <h2 className="ui-h2">{live ? p.sesion.mapa : 'Sin sesión abierta'}</h2>
            {!live && (
              <p className="ui-sub" style={{ fontSize: 14 }}>
                {isMaster ? 'Elegí un mapa y tocá Abrir para empezar.' : 'Esperando que el master abra un mapa.'}
              </p>
            )}
          </div>
          {live && <button className="ui-btn ui-btn-primary" onClick={() => setInRoom(true)}>Entrar a la sala</button>}
          <div className="pt-sep" />
          <div className="pt-master">
            <span className="pt-crown"><Crown /></span>
            <div className="ui-card-main" style={{ gap: 1 }}>
              <span className="ui-acc-kind">Master</span>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {masterName ? masterName + (isMaster ? ' (vos)' : '') : 'Nadie'}
              </span>
            </div>
            {isMaster
              ? <button className="pt-mini" onClick={() => releaseMaster(id, me).catch(err('Master'))}>Soltar</button>
              : <button className="pt-mini" onClick={takeMaster}>{p.masterId ? 'Forzar' : 'Tomar'}</button>}
          </div>
        </section>

        <section className="pt-sec">
          <h2 className="pt-h">Miembros <small>{p.memberIds.length} de {p.max}</small></h2>
          <div className="pt-members">
            {members.map(([uid, m]) => {
              const T = isOwner && uid !== me ? 'button' : 'div'
              const master = uid === p.masterId
              return (
                <T key={uid} className="pt-m" {...(T === 'button' ? { onClick: () => memberMenu(uid) } : {})}>
                  <span className={`pt-av${master ? ' pt-av-master' : ''}`}
                    style={{ background: master ? 'var(--ui-gold)' : hue(uid) }}>
                    {(m.nombre || '?')[0].toUpperCase()}
                    {master && <span className="pt-badge"><Crown size={12} color="#e0a64a" /></span>}
                  </span>
                  <span className="pt-name">{m.nombre}{uid === me ? ' (vos)' : ''}</span>
                  {uid === p.ownerId && <span className="pt-tag">creador</span>}
                </T>
              )
            })}
            {isOwner && (
              <button className="pt-m" aria-label="Invitar" onClick={invite} style={{ color: 'var(--ui-gold)', cursor: 'pointer' }}>
                <span className="pt-av pt-add"><Plus color="#e0a64a" /></span>
                <span className="pt-name">Invitar</span>
              </button>
            )}
          </div>
        </section>

        <section className="pt-sec">
          <h2 className="pt-h">Mapas <small>{maps.length}</small></h2>
          <div className="pt-maps">
            {sorted.map((m) => (
              <div className="pt-tile" key={m.id}>
                <div className="pt-grid" />
                <div className="pt-tile-body">
                  {isMaster ? (
                    <>
                      <span className="pt-tile-name">{m.nombre}</span>
                      <div className="pt-tile-row">
                        <button className="pt-open" onClick={() => start(m)}>Abrir</button>
                        <button className="pt-more" aria-label="Más acciones" onClick={() => mapMenu(m)}><Dots /></button>
                      </div>
                    </>
                  ) : (
                    <div className="pt-tile-row">
                      <span className="pt-tile-name">{m.nombre}</span>
                      <button className="pt-more" aria-label="Más acciones" onClick={() => mapMenu(m)}><Dots /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button className="pt-new" onClick={create}>
              <Plus size={28} color="#a8a296" />
              Nuevo mapa
            </button>
          </div>
        </section>

        {!isOwner && (
          <div className="ui-foot">
            <button className="ui-link" style={{ color: 'var(--ui-danger)' }} onClick={() => expel(me)}>Abandonar party</button>
          </div>
        )}
      </div>
    </main>
  )
}