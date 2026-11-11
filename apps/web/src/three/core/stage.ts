import * as THREE from 'three/webgpu';

export interface Stage {
  readonly renderer: THREE.WebGPURenderer;
  readonly canvas: HTMLCanvasElement;
  readonly backend: 'webgpu' | 'webgl2';
  /** Asks for one frame. Nothing is drawn while nothing changes. */
  invalidate(): void;
  /** False while off screen: no frames at all. */
  setActive(active: boolean): void;
  dispose(): void;
}

export interface StageHooks {
  resize(width: number, height: number): void;
  /** Draws one frame. Returns true while the scene is still moving and needs another. */
  frame(): boolean;
}

/**
 * Renderer and render-on-demand loop shared by every 3D island (CLAUDE.md 3):
 * WebGPU where the browser has it, WebGL 2 otherwise. A still scene costs nothing.
 */
export async function createStage(container: HTMLElement, hooks: StageHooks): Promise<Stage> {
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  canvas.dataset['backend'] = backend;

  let active = true;
  let pending = 0;
  let frames = 0;
  const draw = (): void => {
    pending = 0;
    if (!active) return;
    const moving = hooks.frame();
    canvas.dataset['frames'] = String(++frames);
    if (moving) invalidate();
  };
  const invalidate = (): void => {
    if (active && !pending) pending = requestAnimationFrame(draw);
  };

  const fit = (): void => {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height);
    hooks.resize(width, height);
    invalidate();
  };
  const observer = new ResizeObserver(fit);
  fit();
  container.append(canvas);
  observer.observe(container);

  return {
    renderer,
    canvas,
    backend,
    invalidate,
    setActive(next) {
      active = next;
      if (active) invalidate();
      else cancelAnimationFrame(pending), (pending = 0);
    },
    dispose() {
      active = false;
      cancelAnimationFrame(pending);
      observer.disconnect();
      canvas.remove();
      renderer.dispose();
    },
  };
}
