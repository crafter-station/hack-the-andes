/**
 * JSX for meshline's two elements.
 *
 * `extend()` registers them with the reconciler at runtime, but nothing
 * teaches TypeScript they exist, so they need declaring by hand. Adapted from
 * the declaration crafter-station/badge-creator ships.
 */

import type * as THREE from "three";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      // biome-ignore lint/suspicious/noExplicitAny: the geometry takes the reconciler's whole prop surface
      meshLineGeometry: any;
      meshLineMaterial: {
        readonly color?: string | number | THREE.Color;
        readonly depthTest?: boolean;
        readonly lineWidth?: number;
        readonly map?: THREE.Texture | null;
        readonly repeat?: readonly [number, number] | THREE.Vector2;
        readonly resolution?: readonly [number, number] | THREE.Vector2;
        readonly useMap?: boolean | number;
        readonly transparent?: boolean;
        readonly opacity?: number;
      };
    }
  }
}
