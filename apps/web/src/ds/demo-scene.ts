// A flat stand-in for a real scene, enough to exercise the shell's contract.
// Three.js arrives in phase 1 (CLAUDE.md 14).
import type { Scene, SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';

declare global {
  interface Window {
    tramDemoDisposed?: number;
  }
}

export function createDemoScene({ container }: SceneContext): Scene {
  const canvas = document.createElement('canvas');
  const { width, height } = container.getBoundingClientRect();
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';
  container.append(canvas);

  const color = (name: string): string => {
    const probe = document.createElement('i');
    probe.style.color = `var(${name})`;
    container.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };
  const surface = color('--tram-sys-surface-alt');
  const line = color('--tram-sys-text');
  const active = color('--tram-sys-data-active');

  const KM = 10;
  let km = 0;
  const y = (k: number): number => height * (0.55 - 0.25 * Math.sin((k / KM) * Math.PI * 2));
  const x = (k: number): number => (k / KM) * width;

  const draw = (): void => {
    const c = canvas.getContext('2d')!;
    c.fillStyle = surface;
    c.fillRect(0, 0, width, height);
    c.strokeStyle = line;
    c.lineWidth = 2;
    c.beginPath();
    for (let k = 0; k <= KM; k += 0.1) c.lineTo(x(k), y(k));
    c.stroke();
    c.fillStyle = active;
    c.strokeStyle = line;
    c.beginPath();
    c.arc(x(km), y(km), 8, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  };
  draw();

  return {
    dispose() {
      canvas.remove();
      window.tramDemoDisposed = (window.tramDemoDisposed ?? 0) + 1;
    },
    step(direction) {
      km = Math.min(KM, Math.max(0, km + direction));
      draw();
      return `Km ${km}`;
    },
  };
}
