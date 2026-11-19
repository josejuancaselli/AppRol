import { alertBox } from './ui'

// Textos de error legibles en lugar de códigos como "permission-denied"
const TEXTS = {
  // Firestore
  'permission-denied': 'No tenés permiso para hacer eso',
  unavailable: 'Sin conexión con el servidor. Probá de nuevo en un momento',
  'not-found': 'Ya no existe (¿lo borraron?)',
  'failed-precondition': 'Algo cambió mientras lo hacías. Probá de nuevo',
  aborted: 'Hubo un conflicto con otro cambio. Probá de nuevo',
  'resource-exhausted': 'Se alcanzó el límite de uso. Probá más tarde',
  unauthenticated: 'Tu sesión venció. Volvé a entrar',
  // Reglas propias de la app (ver partyOps.js)
  'master-ocupado': 'Ya hay un master. Usá "Forzar" si querés tomar su lugar',
  'no-master': 'Ya no sos el master de esta party',
  'no-miembro': 'Ya no sos miembro de esta party',
  'ficha-tomada': 'Esa ficha ya la tomó otro jugador',
  // Auth
  'auth/network-request-failed': 'Sin conexión. Revisá tu internet',
  'auth/requires-recent-login': 'Volvé a iniciar sesión para hacer esto',
}

export const errorText = (e) => TEXTS[e?.code] ?? e?.code ?? e?.message ?? 'error desconocido'

// Para usar en .catch(): report('Guardar') muestra "Guardar: <motivo>"
export const report = (what) => (e) => alertBox(`${what}: ${errorText(e)}`, 'Error')