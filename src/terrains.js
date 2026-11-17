export const COLS = 12
export const ROWS = 14

// Naturaleza del terreno. En modo jugar solo 'bloquea' impide colocar una ficha.
export const KIND_ORDER = ['libre', 'dificil', 'bloquea', 'peligro', 'construccion']
export const KIND_LABEL = {
  libre: 'Libre',
  dificil: 'Terreno difícil',
  bloquea: 'Bloquea el paso',
  peligro: 'Peligroso',
  construccion: 'Construcciones',
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
]

export const TERRAIN_BY_ID = Object.fromEntries(TERRAINS.map((t) => [t.id, t]))

// Contraste con texto blanco >= 4.5:1
export const TOKEN_COLORS = ['#c0392b', '#2563eb', '#7c3aed', '#b45309', '#0f766e', '#be185d']
