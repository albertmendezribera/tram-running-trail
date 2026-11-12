import { tramThreeMotion } from '@tram/design-system/three';
import type { Scene, SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { buildShoeSolid, type Mesh, type SolidSpecs } from '@tram/shoe-geometry/solid';
import * as THREE from 'three/webgpu';
import { createStage } from '../core/stage.ts';
import { watchPalette } from '../route-viewer/palette.ts';
import { buildPhotoShoe, type PhotoShoe } from './photo.ts';

export interface ShoeViewerOptions {
  specs: SolidSpecs;
  /** The brand's photos and the outline read off them: shown instead of the drawn solid when there. */
  photo?: PhotoShoe | undefined;
  /** Says where the view is after a turn with the keyboard. */
  announce(degrees: number): string;
  /**
   * Shown as its own mirror image: the other way round, and turning the other way. In a
   * comparison the second shoe is mirrored, so the two face each other and turn together.
   * Left unset, a photo model shows its lateral side: mirrored when it is a left shoe.
   */
  mirror?: boolean | undefined;
  /** Told each time the shoe is turned by hand or by key, in the terms of an unmirrored shoe. */
  onTurn?(yaw: number, pitch: number): void;
}

/** Radians the shoe turns per pixel dragged, and per press of an arrow key. */
const DRAG = 0.008;
const KEY_TURN = Math.PI / 8;
/** Three quarters from the side: the profile and the top of the shoe both read. */
const REST = { yaw: -0.6, pitch: 0.32 };
const PITCH = { min: -0.35, max: 1 };

const geometryOf = (mesh: Mesh): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * The shoe as a solid built from its figures (E05), to turn by hand: the foam
 * lets the plate show through, as in an X-ray. Not a scan: the upper and the
 * outline seen from above are drawn, not measured, and the page says so.
 * It draws only while it turns.
 */
export async function mountShoeViewer({ container, signal, reducedMotion }: SceneContext, o: ShoeViewerOptions): Promise<Scene & { setView(yaw: number, pitch: number): void }> {
  const solid = buildShoeSolid(o.specs);
  const scene = new THREE.Scene();
  const background = new THREE.Color();
  scene.background = background;
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-0.4, 1, 0.8);
  scene.add(sun, new THREE.HemisphereLight(0xffffff, 0xffffff, 1.3));

  const solidMaterial = (): THREE.MeshStandardNodeMaterial => new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const materials = {
    outsole: solidMaterial(),
    // The foam is see-through: what is inside it is the point of the view.
    // …and steps back where it touches the rubber, so the two never fight for the same pixel.
    midsole: Object.assign(solidMaterial(), { transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
    insole: Object.assign(solidMaterial(), { transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    plate: solidMaterial(),
    upper: Object.assign(solidMaterial(), { transparent: true, opacity: 0.08, depthWrite: false }),
  };
  const edgeMaterial = new THREE.LineBasicNodeMaterial();
  const ghostMaterial = new THREE.LineBasicNodeMaterial({ transparent: true, opacity: 0.35 });

  const shoe = new THREE.Group();
  const add = (mesh: Mesh | null, material: THREE.Material, order: number, edges: THREE.Material | null = edgeMaterial): void => {
    if (!mesh) return;
    const geometry = geometryOf(mesh);
    const body = new THREE.Mesh(geometry, material);
    body.renderOrder = order;
    shoe.add(body);
    if (edges) shoe.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), edges));
  };
  const photo = o.photo ? await buildPhotoShoe(o.photo) : undefined;
  const size = photo ? { lengthMm: o.photo!.model.lengthMm, heightMm: o.photo!.model.heightMm } : solid;
  if (photo) shoe.add(photo.mesh);
  else {
    add(solid.plate, materials.plate, 0, null);
    add(solid.outsole, materials.outsole, 1);
    add(solid.lugs, materials.outsole, 1, null);
    add(solid.midsole, materials.midsole, 2);
    add(solid.insole, materials.insole, 3);
    add(solid.upper, materials.upper, 4, null);
    // The upper as a cage of a few lines: a ghost, as in the drawing.
    const cage = new THREE.BufferGeometry();
    cage.setAttribute('position', new THREE.BufferAttribute(new Float32Array(solid.upperCage), 3));
    shoe.add(new THREE.LineSegments(cage, ghostMaterial));
  }
  // Centred on its own middle, so it turns in place.
  shoe.position.set(-size.lengthMm / 2, -size.heightMm * 0.42, 0);
  const pivot = new THREE.Group();
  pivot.add(shoe);
  scene.add(pivot);

  const camera = new THREE.PerspectiveCamera(28, 1, 10, 5000);
  const mirror = o.mirror ?? o.photo?.model.foot === 'left';
  // The view is kept as that of an unmirrored shoe; a mirrored one is drawn turned the other way.
  const view = { yaw: REST.yaw, pitch: REST.pitch };
  const shown = (yaw: number): number => (mirror ? Math.PI - yaw : yaw);
  let reveal = reducedMotion ? 1 : 0;
  let last = 0;
  const place = (): void => {
    // The entrance: the shoe comes round from its side to rest. Not with reduced motion.
    const eased = 1 - (1 - reveal) ** 3;
    pivot.rotation.set(view.pitch, shown(view.yaw - (1 - eased) * 1.1), 0, 'XYZ');
  };

  const stage = await createStage(container, {
    resize(width, height) {
      camera.aspect = width / height;
      // Far enough for the whole length at any turn, in a wide or a tall frame.
      const reach = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const distance = Math.max((size.lengthMm * 1.25) / (reach * camera.aspect), (size.lengthMm * 0.72) / reach);
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    },
    frame() {
      const now = performance.now();
      if (reveal < 1) {
        reveal = Math.min(1, reveal + (last ? (now - last) / (tramThreeMotion.route * 1.5) : 0));
        last = now;
      }
      place();
      stage.renderer.render(scene, camera);
      return reveal < 1;
    },
  });
  if (signal.aborted) {
    stage.dispose();
    throw new DOMException('aborted', 'AbortError');
  }

  watchPalette(container, signal, (c) => {
    background.setRGB(...c.surface.linear);
    materials.outsole.color.setRGB(...c['data-primary'].linear);
    materials.midsole.color.setRGB(...c['surface-alt'].linear);
    materials.insole.color.setRGB(...c['surface-tint'].linear);
    materials.plate.color.setRGB(...c.text.linear);
    materials.upper.color.setRGB(...c['text-muted'].linear);
    edgeMaterial.color.setRGB(...c.text.linear);
    ghostMaterial.color.setRGB(...c['text-muted'].linear);
    stage.invalidate();
  });

  // Dragging turns the shoe. A finger turns it sideways only, so the page still scrolls under it.
  const canvas = stage.canvas;
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  let drag: { id: number; x: number; y: number } | undefined;
  const turn = (yaw: number, pitch: number): void => {
    reveal = 1;
    // The shoe follows the hand: on a mirrored shoe that is the opposite turn.
    view.yaw += mirror ? -yaw : yaw;
    view.pitch = Math.min(PITCH.max, Math.max(PITCH.min, view.pitch + pitch));
    canvas.dataset['yaw'] = shown(view.yaw).toFixed(3);
    stage.invalidate();
    o.onTurn?.(view.yaw, view.pitch);
  };
  canvas.addEventListener('pointerdown', (event) => {
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }, { signal });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    turn((event.clientX - drag.x) * DRAG, event.pointerType === 'touch' ? 0 : (event.clientY - drag.y) * DRAG);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }, { signal });
  const release = (): void => {
    drag = undefined;
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', release, { signal });
  canvas.addEventListener('pointercancel', release, { signal });
  canvas.dataset['yaw'] = shown(view.yaw).toFixed(3);
  stage.invalidate();

  return {
    setView(yaw, pitch) {
      reveal = 1;
      view.yaw = yaw;
      view.pitch = pitch;
      canvas.dataset['yaw'] = shown(view.yaw).toFixed(3);
      stage.invalidate();
    },
    step(direction) {
      turn(direction * KEY_TURN, 0);
      const degrees = Math.round((((THREE.MathUtils.radToDeg((mirror ? -1 : 1) * (view.yaw - REST.yaw)) % 360) + 360) % 360) / 22.5) * 22.5;
      return o.announce(degrees % 360);
    },
    setActive: (active) => stage.setActive(active),
    dispose() {
      stage.dispose();
      photo?.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      for (const material of [...Object.values(materials), edgeMaterial, ghostMaterial]) material.dispose();
    },
  };
}
