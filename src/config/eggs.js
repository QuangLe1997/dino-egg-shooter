// Dino-egg colour set + grid geometry for the bubble shooter.
// Eggs are drawn procedurally on the canvas (no image assets) — each colour is a
// shell tint, a speckle colour, and a glow used by particles/highlights.

export const EGG_COLORS = [
  { key: 'ruby',  shell: '#ff5a6e', spot: '#b81d3a', glow: '#ffb3bd' },
  { key: 'sun',   shell: '#ffce3a', spot: '#d99300', glow: '#fff0a8' },
  { key: 'leaf',  shell: '#5ed24f', spot: '#2c8a2f', glow: '#bff0a8' },
  { key: 'sky',   shell: '#46b3ff', spot: '#1668c9', glow: '#bfe6ff' },
  { key: 'grape', shell: '#b98cff', spot: '#6a35c9', glow: '#e6d4ff' },
  { key: 'coral', shell: '#ff944d', spot: '#c2521a', glow: '#ffd2ad' },
];

// Hex/offset grid. Even rows have `cols` cells; odd rows have `cols-1`, shifted
// right by half a cell (classic brick packing).
export const GRID = {
  cols: 8,      // columns on even rows
  cellD: 52,    // spacing between egg centres
  R: 24,        // egg visual radius (< cellD/2 leaves a small gap)
  marginX: 14,  // side wall inset
  topY: 64,     // ceiling y (just under the HUD top bar)
  rowH: 45,     // ≈ cellD * 0.866 (hex vertical pitch)
};

export const SHOT_SPEED = 770; // px/s projectile speed
