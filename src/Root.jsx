import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from 'firebase/auth'
import { addDoc, arrayUnion, collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from './firebase'
import { auth } from './auth'
import App from './App.jsx'
import Party from './Party.jsx'

const nick = (u) => u.displayName || u.email?.split('@')[0] || 'Jugador'

export default function Root() {
  const [user, setUser] = useState(undefined)
  const [pid, setPid] = useState(() => localStorage.getItem('rol-party') || '')
  const [loose, setLoose] = useState(
    () => !!(new URLSearchParams(location.search).get('sala') || localStorage.getItem('rol-sala')))

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
    getDoc(doc(db, 'parties', id)).then(async (s) => {
      const p = s.data()
      if (!p || p.inviteCode !== inv) return alert('Invitación no válida')
      if (!p.memberIds.includes(user.uid)) {
        if (p.memberIds.length >= p.max) return alert('La party está llena')
        await updateDoc(s.ref, {
          memberIds: arrayUnion(user.uid),
          ['members.' + user.uid]: { nombre: nick(user) },
        })
      }
      open(id)
    }).catch((e) => alert('Unirse: ' + e.code))
  }, [user])

  if (loose) {
    return (
      <>
        <App />
        <button className="tool" onClick={() => { localStorage.removeItem('rol-sala'); setLoose(false) }}>← Volver</button>
      </>
    )
  }
  if (user === undefined) return <main className="app lobby"><p>Cargando…</p></main>
  if (user && pid) return <Party id={pid} user={user} onBack={() => open('')} />

  return (
    <main className="app lobby">
      <header className="top"><h1>Mapa de rol</h1></header>
      {user ? <Parties user={user} onOpen={open} /> : <Login />}
      <div className="tools">
        <button className="tool" onClick={() => setLoose(true)}>Sala suelta</button>
        {user && <button className="tool" onClick={() => signOut(auth)}>Cerrar sesión</button>}
      </div>
    </main>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const go = (fn) => fn(auth, email.trim(), pass).catch((e) => alert(e.code))

  return (
    <>
      <div className="tools">
        <button className="tool"
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider()).catch(() => {})}>
          Entrar con Google
        </button>
      </div>
      <div className="tools">
        <input className="room-input" type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <input className="room-input" type="password" placeholder="Contraseña" value={pass}
          onChange={(e) => setPass(e.target.value)} />
      </div>
      <div className="tools">
        <button className="tool" onClick={() => go(signInWithEmailAndPassword)}>Entrar</button>
        <button className="tool" onClick={() => go(createUserWithEmailAndPassword)}>Crear cuenta</button>
      </div>
    </>
  )
}

function Parties({ user, onOpen }) {
  const [list, setList] = useState([])
  const [name, setName] = useState('')

  useEffect(() => onSnapshot(
    query(collection(db, 'parties'), where('memberIds', 'array-contains', user.uid)),
    (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => alert('Lista: ' + e.code)), [user.uid])

  const create = async () => {
    const nombre = name.trim()
    if (!nombre) return
    setName('')
    try {
      await addDoc(collection(db, 'parties'), {
        nombre,
        ownerId: user.uid,
        masterId: null,
        max: 10,
        memberIds: [user.uid],
        members: { [user.uid]: { nombre: nick(user) } },
        inviteCode: Math.random().toString(36).slice(2, 10),
        sesion: { estado: 'lobby', mapId: null },
      })
    } catch (e) {
      alert('Crear: ' + e.code)
    }
  }

  return (
    <>
      <p>{nick(user)}</p>
      {list.map((p) => (
        <button key={p.id} className="tool" onClick={() => onOpen(p.id)}>
          {p.nombre} · {p.memberIds.length}/{p.max}{p.ownerId === user.uid ? ' · creador' : ''}
        </button>
      ))}
      <div className="tools">
        <input className="room-input" placeholder="Nombre de la party" value={name}
          onChange={(e) => setName(e.target.value)} />
        <button className="tool" disabled={!name.trim()} onClick={create}>Crear party</button>
      </div>
    </>
  )
}