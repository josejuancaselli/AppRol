export const COLS = 12
export const ROWS = 14

// Grupos del panel de terrenos, en este orden. La naturaleza de cada terreno
// (libre, difícil, bloquea...) se indica en su `note`.
export const KIND_ORDER = ['libre', 'dificil', 'bloquea', 'peligro', 'construccion', 'cueva', 'ciudad']
export const KIND_LABEL = {
  libre: 'Libre',
  dificil: 'Terreno difícil',
  bloquea: 'Bloquea el paso',
  peligro: 'Peligroso',
  construccion: 'Construcciones',
  cueva: 'Cuevas',
  ciudad: 'Ciudad y campamento',
}

export const TERRAINS = [
  { id: 'grass', label: 'Pasto', kind: 'libre', note: 'Terreno libre' },
  { id: 'road', label: 'Camino', kind: 'libre', note: 'Terreno libre' },
  { id: 'sand', label: 'Arena', kind: 'dificil', note: 'Terreno difícil' },
  { id: 'mud', label: 'Lodo', kind: 'dificil', note: 'Terreno difícil' },
  { id: 'brush', label: 'Maleza', kind: 'dificil', note: 'Terreno difícil' },
  { id: 'vines', label: 'Enredadera', kind: 'dificil', note: 'Terreno difícil, puede atrapar' },
  { id: 'river', label: 'Río', kind: 'dificil', note: 'Terreno difícil, hay corriente' },
  { id: 'rock', label: 'Roca', kind: 'bloquea', note: 'Bloquea el paso' },
  { id: 'tree', label: 'Árbol', kind: 'bloquea', note: 'Bloquea el paso' },
  { id: 'cliff', label: 'Barranco', kind: 'bloquea', note: 'Bloquea el paso' },
  { id: 'water', label: 'Agua', kind: 'bloquea', note: 'Agua profunda, bloquea el paso' },
  { id: 'lava', label: 'Lava', kind: 'peligro', note: 'Causa daño grave por fuego' },
  { id: 'floor', label: 'Piso interior', kind: 'construccion', note: 'Piso de madera' },
  { id: 'cave', label: 'Cueva', kind: 'construccion', note: 'Entrada de cueva' },
  // Cuevas (el dibujo de cada uno está en terrains-extra.css)
  { id: 'cavefloor', label: 'Suelo de cueva', kind: 'cueva', note: 'Terreno libre' },
  { id: 'stalagmite', label: 'Estalagmita', kind: 'cueva', note: 'Sale del suelo: terreno difícil' },
  { id: 'stalactite', label: 'Estalactita', kind: 'cueva', note: 'Cuelga del techo: no estorba el paso' },
  // Ciudad y campamento
  { id: 'cobble', label: 'Adoquines', kind: 'ciudad', note: 'Terreno libre' },
  { id: 'house', label: 'Casa', kind: 'ciudad', note: 'Casa medieval, bloquea el paso' },
  { id: 'tower', label: 'Torre', kind: 'ciudad', note: 'Torre de piedra, bloquea el paso' },
  { id: 'rampart', label: 'Muralla', kind: 'ciudad', note: 'Bloquea el paso' },
  { id: 'well', label: 'Pozo', kind: 'ciudad', note: 'Bloquea el paso' },
  { id: 'market', label: 'Puesto de mercado', kind: 'ciudad', note: 'Lona y mesa, bloquea el paso' },
  { id: 'tent', label: 'Tienda de campaña', kind: 'ciudad', note: 'Campamento: se puede entrar' },
  { id: 'campfire', label: 'Fogata', kind: 'ciudad', note: 'Da luz; quema si se pisa' },
  { id: 'crops', label: 'Cultivos', kind: 'ciudad', note: 'Terreno difícil' },
  { id: 'bridge', label: 'Puente (horizontal)', kind: 'ciudad', note: 'Se cruza sobre el agua' },
  { id: 'bridgev', label: 'Puente (vertical)', kind: 'ciudad', note: 'Se cruza sobre el agua' },
]

export const TERRAIN_BY_ID = Object.fromEntries(TERRAINS.map((t) => [t.id, t]))

// Contraste con texto blanco >= 4.5:1
// El amarillo (Jugador 1) lleva texto oscuro
export const tokenStyle = (id) => ({ background: TOKEN_COLORS[id], color: id === 0 ? '#1a1a1a' : '#fff' })
export const TOKEN_COLORS = ['#facc15', '#2563eb', '#7c3aed', '#b45309', '#0f766e', '#be185d']