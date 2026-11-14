// Buildings modelled by hand for the view from the ground (E18): the ones a place is known by, which
// a map gives a footprint and a height and nothing else. Each is drawn from photographs of the real
// building, named here, and stands where the ICGC's map has it.
import type { LandmarkModel } from '../three/walk-viewer/landmarks.ts';

export interface RouteLandmark {
  model: LandmarkModel;
  name: string;
  /** Where it stands, in UTM 31N (EPSG:25831): the ICGC's own point for it. */
  utm: readonly [number, number];
  /** Turn about the vertical, in degrees, from the outline the cadastre has for it. */
  turnDeg: number;
  /** The photographs it was modelled from: none is reproduced, they are what it was checked against. */
  references: readonly string[];
}

export const LANDMARKS: Record<string, readonly RouteLandmark[]> = {
  palamos: [
    {
      model: 'far-de-palamos',
      name: 'Far de Palamós',
      utm: [510717.1, 4632190.4],
      turnDeg: 8,
      references: [
        'https://commons.wikimedia.org/wiki/File:21_Far_de_Palamós,_a_la_punta_des_Molí.jpg',
        'https://commons.wikimedia.org/wiki/File:20_Far_de_Palamós,_a_la_punta_des_Molí.jpg',
        'https://commons.wikimedia.org/wiki/File:Faro_de_Palamos.jpg',
      ],
    },
  ],
};
