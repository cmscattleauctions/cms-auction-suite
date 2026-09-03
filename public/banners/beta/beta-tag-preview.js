/* =============================================================
 * Beta OBS Builder — Verification Tag Placement live preview
 * -------------------------------------------------------------
 * Draws a small 16:9 representation of the 3840x2160 canvas with two
 * sample tags positioned bottom-right, so the Settings page's Tag
 * Height/Spacing/Right Margin/Bottom Margin numbers are legible
 * visually instead of purely as raw px values.
 *
 * Reuses the real, pure layoutTagRow() from beta-obs-augment.js
 * unchanged — this is a visualization only, it never affects what
 * actually gets written into the OBS scene collection.
 * ============================================================= */

import { layoutTagRow } from './beta-obs-augment.js';

const CANVAS_W = 3840, CANVAS_H = 2160;

// Two representative sample tags — placeholder dimensions only, no real
// tag image is loaded (this is a settings-page visualization, not an
// actual build). Widths chosen to look like typical short/medium tags.
const SAMPLE_TAGS = [
  { id: 'sample-a', name: 'ASV', naturalWidth: 420, naturalHeight: 180, contentWidth: 420, contentHeight: 180, contentX: 0, contentY: 0, sortOrder: 0 },
  { id: 'sample-b', name: 'NHTC', naturalWidth: 340, naturalHeight: 180, contentWidth: 340, contentHeight: 180, contentX: 0, contentY: 0, sortOrder: 1 },
];
const SAMPLE_ASSETS = new Map(SAMPLE_TAGS.map(t => [t.id, t]));

/** @param canvasEl <canvas> element (its own width/height attrs set the preview resolution) */
export function renderTagPlacementPreview(canvasEl, layout) {
  const ctx = canvasEl.getContext('2d');
  const w = canvasEl.width, h = canvasEl.height;
  const scale = w / CANVAS_W;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0e1620';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  const { positions } = layoutTagRow(SAMPLE_TAGS.map(t => t.id), SAMPLE_ASSETS, layout, CANVAS_W, CANVAS_H);

  const fontSize = Math.max(9, Math.round(h * 0.07));
  positions.forEach(p => {
    const asset = SAMPLE_ASSETS.get(p.tagId);
    if (!asset) return;
    const x = p.x * scale, y = p.y * scale;
    const bw = asset.contentWidth * p.scale * scale, bh = asset.contentHeight * p.scale * scale;

    ctx.fillStyle = '#2563a3';
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = '#8fbde0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(asset.name, x + bw / 2, y + bh / 2);
  });
}
