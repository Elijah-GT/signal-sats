import type { Point } from '../../shared/engine/types';
import { LAYOUT } from '../../shared/layout';

/** How far the pointer must move before a press becomes a drag, in pixels. */
export const DRAG_START = 8;

/**
 * The board square under a point on the screen, or null when it's outside the
 * grid. Works however the board SVG is scaled.
 */
export const cellAt = (
  svg: SVGSVGElement,
  size: { width: number; height: number },
  clientX: number,
  clientY: number
): Point | null => {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  const x = Math.floor((p.x - LAYOUT.pad) / LAYOUT.cell);
  const y = Math.floor((p.y - LAYOUT.top) / LAYOUT.cell);
  return x >= 0 && y >= 0 && x < size.width && y < size.height
    ? { x, y }
    : null;
};
