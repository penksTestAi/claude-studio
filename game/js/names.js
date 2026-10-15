// Generated display names. Players never type a name and never receive text from another player:
// a peer sends only a number (its seed) and every browser turns that number into words from these lists.

const ADJ = ["Grey", "Amber", "Quiet", "Silver", "Ash", "Moss", "Copper", "Pale", "Dusk", "Salt", "Ember", "Fern",
  "Slate", "Tawny", "Misty", "Brisk", "Russet", "Frost", "Linen", "Olive", "Cinder", "Hazel", "Sable", "Dune",
  "Pebble", "Willow", "Iron", "Rain", "Briar", "Clover", "Lantern", "Harbour"];
const BIRD = ["Heron", "Wren", "Owl", "Plover", "Tern", "Finch", "Lark", "Crane", "Swift", "Kestrel", "Curlew", "Robin",
  "Gannet", "Puffin", "Thrush", "Avocet", "Dunlin", "Merlin", "Nightjar", "Sparrow", "Petrel", "Linnet", "Egret",
  "Godwit", "Starling", "Shrike", "Bunting", "Dipper", "Grebe", "Rail", "Sanderling", "Warbler"];

// Lantern colours for avatars; chosen to read on the dark night map.
export const COLOURS = ["#f2b84b", "#7fd1c7", "#e98a6b", "#b5a6f0", "#9ad06f", "#f08fb5", "#6fb2f0", "#e8e1c9"];

export function isSeed(n) { return Number.isInteger(n) && n >= 0 && n <= 0xffffffff; }

export function nameFor(seed) {
  const a = ADJ[seed % ADJ.length];
  const b = BIRD[Math.floor(seed / ADJ.length) % BIRD.length];
  const n = 1 + (Math.floor(seed / (ADJ.length * BIRD.length)) % 99);
  return `${a} ${b} ${n}`;
}

export function colourFor(seed) { return COLOURS[Math.floor(seed / 7) % COLOURS.length]; }

export function newSeed() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}
