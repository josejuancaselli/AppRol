import { arrayRemove, deleteField, doc, runTransaction, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

const partyRef = (id) => doc(db, 'parties', id)
const roomRef = (id) => doc(db, 'rooms', id)
const fail = (code) => Object.assign(new Error(code), { code })

// Aplica muchas operaciones en lotes atómicos (writeBatch admite hasta 500 por lote).
// Cada operación es (batch) => batch.delete(...) / batch.update(...) / batch.set(...).
export async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db)
    ops.slice(i, i + 400).forEach((op) => op(b))
    await b.commit()
  }
}

// Borra una party completa. La party se borra al final, así un corte a mitad no deja
// mapas o salas huérfanos apuntando a una party inexistente.
export const deleteParty = (partyId, inviteCode, mapRefs) => commitOps([
  ...mapRefs.map((r) => (b) => b.delete(r)),
  (b) => b.delete(roomRef(partyId)),
  (b) => b.delete(doc(db, 'invites', inviteCode)),
  (b) => b.delete(partyRef(partyId)),
])

// ── Master ───────────────────────────────────────────────────────────────────
// Siempre hay a lo sumo un master. El único dato que manda es parties/{id}.masterId (la
// pantalla de la sala también lo toma de ahí). Cada transacción lee el estado actual del
// servidor antes de escribir, así dos personas apretando a la vez no pueden quedar las dos
// como master. Estas operaciones NO tocan la sala: las reglas de Firestore evalúan quién es
// master con el valor de ANTES de la escritura, y rooms/{id}.master solo se escribe al abrir.

// Toma el master. Si ya hay otro falla ('master-ocupado'), salvo que force sea true.
export const claimMaster = (partyId, uid, force = false) =>
  runTransaction(db, async (tx) => {
    const p = await tx.get(partyRef(partyId))
    if (!p.exists() || !p.data().memberIds?.includes(uid)) throw fail('no-miembro')
    const current = p.data().masterId
    if (current && current !== uid && !force) throw fail('master-ocupado')
    tx.update(partyRef(partyId), { masterId: uid })
  })

// Suelta el master (solo si todavía es de uid)
export const releaseMaster = (partyId, uid) =>
  runTransaction(db, async (tx) => {
    const p = await tx.get(partyRef(partyId))
    if (!p.exists() || p.data().masterId !== uid) return
    tx.update(partyRef(partyId), { masterId: null })
  })

// Saca a un miembro (expulsión o abandono). Si era el master, deja libre el puesto.
export const removeMember = (partyId, uid) =>
  runTransaction(db, async (tx) => {
    const p = await tx.get(partyRef(partyId))
    if (!p.exists()) return
    const wasMaster = p.data().masterId === uid
    tx.update(partyRef(partyId), {
      memberIds: arrayRemove(uid),
      ['members.' + uid]: deleteField(),
      ...(wasMaster ? { masterId: null } : {}),
    })
  })

// ── Sesión ───────────────────────────────────────────────────────────────────

// Abre la sala con un mapa. Solo puede hacerlo quien es master en este momento.
export const startSession = (partyId, uid, roomData, mapId, mapName) =>
  runTransaction(db, async (tx) => {
    const p = await tx.get(partyRef(partyId))
    if (!p.exists() || p.data().masterId !== uid) throw fail('no-master')
    tx.set(roomRef(partyId), { ...roomData, order: roomData.order ?? [], abierta: false, master: uid, claims: {} })
    tx.update(partyRef(partyId), { sesion: { estado: 'jugando', mapId, mapa: mapName } })
  })

// Termina la sesión: guarda el mapa (si se pasa mapData), borra la sala y vuelve al lobby,
// todo junto o nada.
export function endSession(partyId, mapId, mapData) {
  const b = writeBatch(db)
  if (mapData) b.update(doc(db, 'parties', partyId, 'maps', mapId), mapData)
  b.delete(roomRef(partyId))
  b.update(partyRef(partyId), { sesion: { estado: 'lobby', mapId: null } })
  return b.commit()
}

// ── Sala ─────────────────────────────────────────────────────────────────────

// Tomar una ficha: si dos jugadores la eligen a la vez, solo uno se la queda
export const claimToken = (roomId, client, tokenId) =>
  runTransaction(db, async (tx) => {
    const s = await tx.get(roomRef(roomId))
    if (!s.exists()) return
    const owner = s.data().claims?.[tokenId]
    if (owner && owner !== client) throw fail('ficha-tomada')
    tx.update(roomRef(roomId), { ['claims.' + tokenId]: client })
  })

// Agregar un enemigo: el número se calcula con los datos del servidor dentro de la transacción,
// así dos altas simultáneas nunca repiten id ni caen en la misma celda
export const addEnemy = (roomId, pos, boss) =>
  runTransaction(db, async (tx) => {
    const s = await tx.get(roomRef(roomId))
    if (!s.exists()) return
    const d = s.data()
    const taken = Object.values(d.enemies ?? {}).some((e) => e.pos === pos)
      || Object.values(d.tokens ?? {}).some((t) => t.pos === pos)
    if (taken) return
    const id = Object.keys(d.enemies ?? {}).reduce((max, k) => Math.max(max, Number(k)), 0) + 1
    tx.update(roomRef(roomId), { ['enemies.' + id]: { pos, dead: false, boss } })
  })