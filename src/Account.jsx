import { useState } from 'react'
import {
  EmailAuthProvider, GoogleAuthProvider, deleteUser, reauthenticateWithCredential,
  reauthenticateWithPopup, signOut,
} from 'firebase/auth'
import {
  arrayRemove, collection, deleteDoc, deleteField, doc, getDocs, query, updateDoc, where,
} from 'firebase/firestore'
import { db } from './firebase'
import { auth } from './auth'
import { alertBox, confirmBox, promptBox } from './ui'

export const nick = (u) => u.displayName || u.email?.split('@')[0] || 'Jugador'

// Botón de cuenta (círculo con la inicial) y su hoja: cerrar sesión y borrar perfil.
// reset(): se llama al salir o borrar, para olvidar la party abierta.
export default function Account({ user, reset }) {
  const [open, setOpen] = useState(false)
  const name = nick(user)
  const initial = name[0].toUpperCase()
  const kind = user.providerData[0]?.providerId === 'password' ? 'Cuenta de email' : 'Cuenta de Google'

  const logout = async () => {
    setOpen(false)
    reset()
    await signOut(auth)
  }

  const removeProfile = async () => {
    setOpen(false)
    try {
      const s = await getDocs(query(collection(db, 'parties'), where('memberIds', 'array-contains', user.uid)))
      const mine = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      const owned = mine.filter((p) => p.ownerId === user.uid)
      const aviso = owned.length
        ? `Se borrarán las parties que creaste, con todos sus mapas: ${owned.map((p) => p.nombre).join(', ')}.\n\n`
        : ''
      const ok = await confirmBox(`${aviso}Saldrás de las demás parties. No se puede deshacer.`,
        { title: 'Borrar tu perfil', ok: 'Borrar perfil', danger: true })
      if (!ok) return

      // 1. volver a autenticar (Firebase lo exige para borrar la cuenta)
      if (user.providerData[0]?.providerId === 'password') {
        const pass = await promptBox('Confirmá tu contraseña para continuar.',
          { title: 'Confirmar identidad', type: 'password', ok: 'Continuar' })
        if (!pass) return
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pass))
      } else {
        await reauthenticateWithPopup(user, new GoogleAuthProvider())
      }

      // 2. datos
      for (const p of mine) {
        if (p.ownerId === user.uid) {
          const maps = await getDocs(collection(db, 'parties', p.id, 'maps'))
          await Promise.all(maps.docs.map((d) => deleteDoc(d.ref)))
          await deleteDoc(doc(db, 'rooms', p.id))
          await deleteDoc(doc(db, 'invites', p.inviteCode))
          await deleteDoc(doc(db, 'parties', p.id))
        } else {
          if (p.masterId === user.uid && p.sesion?.estado === 'jugando') {
            await updateDoc(doc(db, 'rooms', p.id), { master: null }).catch(() => {})
          }
          await updateDoc(doc(db, 'parties', p.id), {
            memberIds: arrayRemove(user.uid),
            ['members.' + user.uid]: deleteField(),
            ...(p.masterId === user.uid ? { masterId: null } : {}),
          })
        }
      }

      // 3. cuenta
      reset()
      await deleteUser(user)
    } catch (e) { alertBox('Borrar perfil: ' + e.code) }
  }

  return (
    <>
      <button className="ui-avatar" aria-label="Cuenta" onClick={() => setOpen(true)}>{initial}</button>
      {open && (
        <div className="ui-back" onClick={() => setOpen(false)}>
          <div className="ui-dlg" role="dialog" aria-modal="true" aria-labelledby="ui-acc-t"
            onClick={(e) => e.stopPropagation()}>
            <span className="ui-handle" aria-hidden="true" />
            <div className="ui-acc-who">
              <span className="ui-avatar ui-avatar-lg" aria-hidden="true">{initial}</span>
              <div className="ui-stack" style={{ gap: 2 }}>
                <h2 id="ui-acc-t" className="ui-acc-name">{name}</h2>
                <span className="ui-acc-kind">{kind}</span>
              </div>
            </div>
            <div className="ui-line" />
            <div className="ui-stack ui-gap-sm">
              <button className="ui-btn ui-btn-secondary" onClick={logout}>Cerrar sesión</button>
              <button className="ui-btn ui-btn-danger" onClick={removeProfile}>Borrar mi perfil</button>
              <span className="ui-note">Borra las parties que creaste y te saca de las demás.</span>
              <button className="ui-btn ui-btn-ghost" onClick={() => setOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}