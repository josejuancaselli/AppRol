// Modificadores: efectos que se colocan SOBRE el terreno (conjuros, trampas,
// interacciones con el mapa). Las notas son resúmenes orientativos, no reglas oficiales.
// `blocks: true` impide mover fichas a esa celda en modo jugar.
// `ref` son conjuros de D&D 5e de ejemplo.

export const MOD_GROUPS = [
  { id: 'elemental', label: 'Elementales' },
  { id: 'sustancia', label: 'Sustancias' },
  { id: 'vision', label: 'Visión y aire' },
  { id: 'movimiento', label: 'Movimiento y trampas' },
  { id: 'magico', label: 'Zonas mágicas' },
]

export const MODIFIERS = [
  // Elementales
  { id: 'fire', group: 'elemental', label: 'Fuego', note: 'Daño por fuego, puede incendiar lo inflamable', ref: 'Create Bonfire, Wall of Fire' },
  { id: 'ice', group: 'elemental', label: 'Hielo', note: 'Resbaladizo: terreno difícil y riesgo de caer', ref: 'Wall of Ice, Sleet Storm' },
  { id: 'acid', group: 'elemental', label: 'Ácido', note: 'Daño por ácido', ref: '' },
  { id: 'flood', group: 'elemental', label: 'Inundación', note: 'Agua baja: terreno difícil, apaga el fuego', ref: 'Control Water' },

  // Sustancias
  { id: 'oil', group: 'sustancia', label: 'Aceite', note: 'Resbaladizo e inflamable', ref: '' },
  { id: 'grease', group: 'sustancia', label: 'Grasa', note: 'Terreno difícil, riesgo de caer', ref: 'Grease' },

  // Visión y aire
  { id: 'fog', group: 'vision', label: 'Niebla', note: 'Visión muy reducida; el viento fuerte la dispersa', ref: 'Fog Cloud' },
  { id: 'poison', group: 'vision', label: 'Gas venenoso', note: 'Daño por veneno al entrar o empezar el turno', ref: 'Stinking Cloud, Cloudkill' },
  { id: 'darkness', group: 'vision', label: 'Oscuridad', note: 'Bloquea la visión, incluso la visión en la oscuridad', ref: 'Darkness' },
  { id: 'light', group: 'vision', label: 'Luz', note: 'Iluminación brillante', ref: 'Light, Daylight' },

  // Movimiento y trampas
  { id: 'web', group: 'movimiento', label: 'Telaraña', note: 'Terreno difícil, puede inmovilizar', ref: 'Web' },
  { id: 'entangle', group: 'movimiento', label: 'Enredo', note: 'Maleza mágica que puede inmovilizar', ref: 'Entangle' },
  { id: 'overgrowth', group: 'movimiento', label: 'Vegetación densa', note: 'Moverse cuesta mucho más', ref: 'Plant Growth' },
  { id: 'spikes', group: 'movimiento', label: 'Púas', note: 'Terreno difícil, daño al moverse, difícil de ver', ref: 'Spike Growth' },
  { id: 'tentacles', group: 'movimiento', label: 'Tentáculos', note: 'Terreno difícil, inmovilizan y dañan', ref: "Evard's Black Tentacles" },
  { id: 'rubble', group: 'movimiento', label: 'Escombros', note: 'Terreno difícil', ref: 'Erupting Earth, Mold Earth' },
  { id: 'pit', group: 'movimiento', label: 'Foso', note: 'Caída al entrar', ref: 'Earthquake' },
  { id: 'wall', group: 'movimiento', label: 'Muro mágico', note: 'Bloquea el paso', ref: 'Wall of Force, Wall of Stone', blocks: true },

  // Zonas mágicas
  { id: 'silence', group: 'magico', label: 'Silencio', note: 'Sin sonido: no se pueden lanzar conjuros verbales', ref: 'Silence' },
  { id: 'holy', group: 'magico', label: 'Sagrado', note: 'Zona consagrada con efectos protectores', ref: 'Hallow' },
  { id: 'cursed', group: 'magico', label: 'Maldito', note: 'Zona profanada con efectos dañinos', ref: 'Hallow' },
  { id: 'antimagic', group: 'magico', label: 'Antimagia', note: 'Suprime conjuros y objetos mágicos', ref: 'Antimagic Field' },
]

export const MOD_BY_ID = Object.fromEntries(MODIFIERS.map((m) => [m.id, m]))
