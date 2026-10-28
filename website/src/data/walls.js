/**
 * Freie Wandflächen im Haus.
 * Nur hier darf gezeichnet und geschrieben werden — Rahmen und Regale bleiben unberührt.
 */
export const GRAFFITI_WALLS = [
  { id: 'halle-west', title: 'Westwand · Halle', room: 'Halle', x: -9.84, z: 5.5, rot: Math.PI / 2, w: 4.6, h: 3.0 },
  { id: 'halle-ost', title: 'Ostwand · Halle', room: 'Halle', x: 9.84, z: 5.5, rot: -Math.PI / 2, w: 4.6, h: 3.0 },
  { id: 'halle-nord-west', title: 'Nordwand · Halle, links', room: 'Halle', x: -6.6, z: -7.84, rot: 0, w: 4.6, h: 2.8 },
  { id: 'halle-nord-ost', title: 'Nordwand · Halle, rechts', room: 'Halle', x: 6.6, z: -7.84, rot: 0, w: 4.6, h: 2.8 },
  { id: 'tunnel-west', title: 'Westwand · Tunnel', room: 'Tunnel', x: 5.14, z: -22.5, rot: Math.PI / 2, w: 5.0, h: 2.4 },
  { id: 'vault-nord', title: 'Nordwand · Verbindung', room: 'Verbindungsraum', x: 3.4, z: -33.84, rot: 0, w: 4.2, h: 2.6 },
];

export function wallById(id) {
  return GRAFFITI_WALLS.find((wall) => wall.id === id);
}
