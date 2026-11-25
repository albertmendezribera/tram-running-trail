import type { Scene, SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import * as THREE from 'three/webgpu';
import { SPZLoader } from 'three/addons/loaders/SPZLoader.js';
import { GaussianSplat } from 'three/addons/objects/GaussianSplat.js';
import { createStage } from '../core/stage.ts';
import { watchPalette } from '../route-viewer/palette.ts';

export interface SplatViewerOptions {
  /** Where the splat is: an `.spz` file of the object alone, with the Z axis up, as the capture had it. */
  url: string;
  /** Says where the view is after a turn with the keyboard. */
  announce(degrees: number): string;
}

/** Radians the shoe turns per pixel dragged, and per press of an arrow key. */
const DRAG = 0.008;
const KEY_TURN = Math.PI / 8;
/** Three quarters from the side: the profile and the top of the shoe both read. */
const REST = { yaw: -0.6, pitch: 0.32 };
/** A scan is seen from under too: the sole is part of it. */
const PITCH = { min: -1.2, max: 1.2 };

/**
 * A scanned shoe as Gaussian splats (E06), to turn by hand. The splats are drawn by three.js's own
 * splat object, on the renderer every 3D island of the site shares: WebGPU where the browser has it,
 * WebGL 2 otherwise. It draws only while it turns.
 */
export async function mountSplatViewer({ container, signal, reducedMotion }: SceneContext, o: SplatViewerOptions): Promise<Scene> {
  const geometry = await new SPZLoader().loadAsync(o.url);
  if (signal.aborted) throw new DOMException('aborted', 'AbortError');
  // Where the object is and how large: between the 1st and the 99th hundredth of its splats along each
  // axis. A training leaves a few splats far from the object, and a box around all of them would be theirs.
  const positions = geometry.getAttribute('position');
  const span = (axis: 0 | 1 | 2): [number, number] => {
    const values = Float32Array.from({ length: positions.count }, (_, i) => positions.getComponent(i, axis)).sort();
    return [values[Math.floor(values.length * 0.01)]!, values[Math.ceil(values.length * 0.99) - 1]!];
  };
  const [x, y, z] = [span(0), span(1), span(2)];
  const size = new THREE.Vector3(x[1] - x[0], y[1] - y[0], z[1] - z[0]);
  const centre = new THREE.Vector3((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2);

  const scene = new THREE.Scene();
  const background = new THREE.Color();
  scene.background = background;
  const splat = new GaussianSplat(geometry);
  splat.position.copy(centre).multiplyScalar(-1);
  // The capture has the Z axis up and the site's scenes the Y; its length is laid along the X, so that it rests in profile.
  const upright = new THREE.Group();
  upright.add(splat);
  upright.rotation.set(-Math.PI / 2, 0, size.y > size.x ? Math.PI / 2 : 0, 'XYZ');
  const pivot = new THREE.Group();
  pivot.add(upright);
  scene.add(pivot);
  const length = Math.max(size.x, size.y);

  const camera = new THREE.PerspectiveCamera(28, 1, length / 20, length * 20);
  const view = { yaw: REST.yaw, pitch: REST.pitch };
  let reveal = reducedMotion ? 1 : 0;
  let last = 0;
  const stage = await createStage(container, {
    resize(width, height) {
      camera.aspect = width / height;
      // Far enough for the whole length at any turn, in a wide or a tall frame.
      const reach = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const distance = Math.max((length * 1.25) / (reach * camera.aspect), (length * 0.8) / reach);
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    },
    frame() {
      const now = performance.now();
      if (reveal < 1) {
        reveal = Math.min(1, reveal + (last ? (now - last) / 900 : 0));
        last = now;
      }
      // The entrance: the shoe comes round from its side to rest. Not with reduced motion.
      pivot.rotation.set(view.pitch, view.yaw - (1 - (1 - (1 - reveal) ** 3)) * 1.1, 0, 'XYZ');
      stage.renderer.render(scene, camera);
      return reveal < 1;
    },
  });
  if (signal.aborted) {
    stage.dispose();
    throw new DOMException('aborted', 'AbortError');
  }
  // The colours of a splat are those of the photographs it was trained on, already as a screen shows them.
  // The renderer is told not to turn them again, or they come out pale; the paper behind is then given
  // as a screen shows it too.
  stage.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  watchPalette(container, signal, (c) => {
    background.setRGB(...c.surface.linear).convertLinearToSRGB();
    stage.invalidate();
  });

  // Dragging turns the shoe. A finger turns it sideways only, so the page still scrolls under it.
  const canvas = stage.canvas;
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  canvas.dataset['splats'] = String(geometry.getAttribute('position').count);
  let drag: { id: number; x: number; y: number } | undefined;
  const turn = (yaw: number, pitch: number): void => {
    reveal = 1;
    view.yaw += yaw;
    view.pitch = Math.min(PITCH.max, Math.max(PITCH.min, view.pitch + pitch));
    canvas.dataset['yaw'] = view.yaw.toFixed(3);
    stage.invalidate();
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

  return {
    dispose() {
      stage.dispose();
      geometry.dispose();
    },
    step(direction) {
      turn(direction * KEY_TURN, 0);
      const degrees = Math.round((((THREE.MathUtils.radToDeg(view.yaw) % 360) + 360) % 360) / 5) * 5;
      return o.announce(degrees);
    },
    setActive: (active) => stage.setActive(active),
  };
}
