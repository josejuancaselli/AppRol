// Avisos en pantalla (reemplazan a alert) y textos de error legibles.
const listeners = new Set()
let nextId = 1

export const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// kind: 'info' | 'error'
export function notify(text, kind = 'info') {
  const msg = { id: nextId++, text, kind }
  listeners.forEach((fn) => fn(msg))
}

const TEXTS = {
  // Firestore
  'permission-denied': 'No tenés permiso para hacer eso',
  unavailable: 'Sin conexión con el servidor. Probá de nuevo en un momento',
  'not-found': 'Ya no existe (¿lo borraron?)',
  'failed-precondition': 'Algo cambió mientras lo hacías. Probá de nuevo',
  aborted: 'Hubo un conflicto con otro cambio. Probá de nuevo',
  'resource-exhausted': 'Se alcanzó el límite de uso. Probá más tarde',
  unauthenticated: 'Tu sesión venció. Volvé a entrar',
  // Reglas propias de la app
  'master-ocupado': 'Ya hay un master. Usá "Forzar master" si querés tomar su lugar',
  'no-master': 'Ya no sos el master de esta party',
  'no-miembro': 'Ya no sos miembro de esta party',
  'ficha-tomada': 'Esa ficha ya la tomó otro jugador',
  // Auth
  'auth/invalid-credential': 'Email o contraseña incorrectos',
  'auth/wrong-password': 'Email o contraseña incorrectos',
  'auth/user-not-found': 'Email o contraseña incorrectos',
  'auth/invalid-email': 'El email no es válido',
  'auth/missing-email': 'Escribí tu email',
  'auth/missing-password': 'Escribí tu contraseña',
  'auth/email-already-in-use': 'Ya hay una cuenta con ese email',
  'auth/weak-password': 'La contraseña es muy corta (mínimo 6 caracteres)',
  'auth/too-many-requests': 'Demasiados intentos. Esperá un rato',
  'auth/network-request-failed': 'Sin conexión. Revisá tu internet',
  'auth/requires-recent-login': 'Volvé a iniciar sesión para hacer esto',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permití las ventanas emergentes',
}

export const errorText = (e) => TEXTS[e?.code] ?? e?.code ?? e?.message ?? 'error desconocido'

// Para usar en .catch(): report('Guardar') muestra "Guardar: <motivo>"
export const report = (what) => (e) => notify(`${what}: ${errorText(e)}`, 'error')

// Copia al portapapeles; si el navegador no lo permite, muestra el texto para copiarlo a mano
export function copyText(text, ok = 'Copiado') {
  return (navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('sin portapapeles')))
    .then(() => notify(ok), () => window.prompt('Copiá el link', text))
}
