export type ProjectionTopology = 'orthographic' | 'equirectangular' | 'winkel-tripel' | 'mollweide';

export interface ProjectionMutator {
  name: ProjectionTopology;
  label: string;
  forward: (lambda: number, phi: number) => [number, number];
  aspectRatio: number; // width / height
  unfurlBounds: (y: number, R: number, t: number) => number; // Pythagorean limb width
}

export interface MorphingProjectionState {
  unfurlProgress: number; // t in [0.0, 1.0]
  topology: ProjectionTopology;
  rotation: [number, number] | [number, number, number]; // [lambda0, phi0]
  scale: number;
  center: [number, number];
}
