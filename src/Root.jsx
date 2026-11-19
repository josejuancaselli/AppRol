import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged,
  signInWithEmailAndPassword, signInWithPopup,
} from 'firebase/auth'
import {
  arrayUnion, collection, doc, getDoc, onSnapshot, query, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { auth } from './auth'
import Party from './Party.jsx'
import Account, { nick } from './Account'
import { Dialogs, alertBox, confirmBox } from './ui'

const newCode = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

export default function Root() {
  return (
    <>
      <Screens />
      <Dialogs />
    </>
  )
}

function Screens() {
  const [user, setUser] = useState(undefined)
  const [pid, setPid] = useState(() => localStorage.getItem('rol-party') || '')

  const open = (id) => {
    if (id) localStorage.setItem('rol-party', id)
    else localStorage.removeItem('rol-party')
    setPid(id)
  }

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  // Unirse por link de invitación: ?party=ID&inv=CÓDIGO
  useEffect(() => {
    if (!user) return
    const q = new URLSearchParams(location.search)
    const id = q.get('party')
    const inv = q.get('inv')
    if (!id) return
    history.replaceState(null, '', location.pathname)
    const join = async () => {
      const already = await getDoc(doc(db, 'parties', id)).then(() => true, () => false)
      if (already) return open(id)
      const iv = (await getDoc(doc(db, 'invites', inv || '-'))).data()
      if (!iv || iv.partyId !== id) return alertBox('La invitación no es válida.')
      const ok = await confirmBox(`¿Querés unirte a la party "${iv.nombre}" de ${iv.creador}?`,
        { title: 'Unirte a la party', ok: 'Unirme' })
      if (!ok) return
      await updateDoc(doc(db, 'parties', id), {
        memberIds: arrayUnion(user.uid),
        ['members.' + user.uid]: { nombre: nick(user) },
        joinCode: inv,
      })
      open(id)
    }
    join().catch(() => alertBox('No se pudo unir: la invitación ya no es válida o la party está llena.'))
  }, [user])

  if (user === undefined) return <main className="app lobby"><p>Cargando…</p></main>
  if (!user) return <Login />
  if (pid) return <Party id={pid} user={user} onBack={() => open('')} />
  return <Parties user={user} onOpen={open} />
}

const ERR = {
  'auth/invalid-credential': 'Email o contraseña incorrectos',
  'auth/invalid-email': 'El email no es válido',
  'auth/missing-password': 'Escribí tu contraseña',
  'auth/email-already-in-use': 'Ese email ya tiene una cuenta',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
  'auth/too-many-requests': 'Demasiados intentos, probá más tarde',
}

const Logo = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="60" height="60" rx="14" fill="#1f242a" stroke="#343b44" strokeWidth="2" />
    <path d="M22 2v60M42 2v60M2 22h60M2 42h60" stroke="#343b44" strokeWidth="2" />
    <circle cx="32" cy="32" r="8" fill="#e0a64a" />
  </svg>
)

function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    setError('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(ERR[e.code] ?? e.code)
      }
    }
    setBusy(false)
  }

  return (
    <div className="ui-page">
      <main className="ui-screen">
        <div className="ui-stack ui-gap-lg">
          <header className="ui-head">
            <Logo />
            <h1 className="ui-title">Mapa de rol</h1>
            <p className="ui-sub">Mapas compartidos para jugar con tu grupo.</p>
          </header>

          <form className="ui-stack" onSubmit={(e) => {
            e.preventDefault()
            run(() => signInWithEmailAndPassword(auth, email.trim(), pass))
          }}>
            <button type="button" className="ui-btn ui-btn-secondary" disabled={busy}
              onClick={() => run(() => signInWithPopup(auth, new GoogleAuthProvider()))}>
              Continuar con Google
            </button>

            <div className="ui-sep">o con email</div>

            <div className="ui-fieldset">
              <label className="ui-label" htmlFor="email">Email</label>
              <input id="email" className="ui-field" type="email" autoComplete="email"
                placeholder="nombre@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="ui-fieldset">
              <label className="ui-label" htmlFor="pass">Contraseña</label>
              <input id="pass" className="ui-field" type="password" autoComplete="current-password"
                placeholder="Mínimo 6 caracteres" value={pass} aria-invalid={!!error}
                onChange={(e) => setPass(e.target.value)} />
              {error && <span className="ui-error" role="alert">{error}</span>}
            </div>

            <button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>
              {busy ? 'Un momento…' : 'Entrar'}
            </button>
            <button type="button" className="ui-btn ui-btn-outline" disabled={busy}
              onClick={() => run(() => createUserWithEmailAndPassword(auth, email.trim(), pass))}>
              Crear cuenta nueva
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

function Parties({ user, onOpen }) {
  const [list, setList] = useState(undefined)
  const [name, setName] = useState('')

  useEffect(() => onSnapshot(
    query(collection(db, 'parties'), where('memberIds', 'array-contains', user.uid)),
    (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => alertBox('Lista: ' + e.code)), [user.uid])

  const create = async () => {
    const nombre = name.trim()
    if (!nombre) return
    setName('')
    const ref = doc(collection(db, 'parties'))
    const code = newCode()
    const batch = writeBatch(db)
    batch.set(ref, {
      nombre,
      ownerId: user.uid,
      masterId: null,
      max: 10,
      memberIds: [user.uid],
      members: { [user.uid]: { nombre: nick(user) } },
      inviteCode: code,
      sesion: { estado: 'lobby', mapId: null },
    })
    batch.set(doc(db, 'invites', code),
      { partyId: ref.id, ownerId: user.uid, nombre, creador: nick(user) })
    try { await batch.commit() } catch (e) { alertBox('Crear: ' + e.code) }
  }

  return (
    <div className="ui-page">
      <main className="ui-screen ui-top">
        <header className="ui-bar">
          <h1 className="ui-h1">Mis parties</h1>
          <Account user={user} reset={() => onOpen('')} />
        </header>

        {list && list.length === 0 && (
          <div className="ui-empty">
            <Logo />
            <h2 className="ui-h2">Todavía no estás en ninguna party</h2>
            <p className="ui-sub">Creá una para tu grupo, o pedile a quien la creó que te pase el link de invitación.</p>
          </div>
        )}

        {list && list.length > 0 && (
          <div className="ui-stack ui-gap-sm">
            {list.map((p) => (
              <button key={p.id} className="ui-card" onClick={() => onOpen(p.id)}>
                <span className="ui-card-main">
                  <span className="ui-card-title">{p.nombre}</span>
                  <span className="ui-card-meta">
                    <span>{p.memberIds.length} de {p.max} miembros</span>
                    {p.sesion?.estado === 'jugando' && <span className="ui-live"><i className="ui-dot" />En juego</span>}
                  </span>
                </span>
                {p.ownerId === user.uid && <span className="ui-chip">creador</span>}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#a8a296" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4l6 6-6 6" /></svg>
              </button>
            ))}
          </div>
        )}

        <form className="ui-panel" onSubmit={(e) => { e.preventDefault(); create() }}>
          <label className="ui-label" htmlFor="np">Nueva party</label>
          <input id="np" className="ui-field" type="text" placeholder="Nombre de la party" value={name}
            onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="ui-btn ui-btn-primary" disabled={!name.trim()}>Crear party</button>
        </form>
      </main>
    </div>
  )
}