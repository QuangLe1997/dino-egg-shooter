// Dino-egg colour set + grid geometry for the bubble shooter.
// Eggs are drawn procedurally on the canvas (no image assets) — each colour is a
// shell tint, a speckle colour, and a glow used by particles/highlights.

// Vivid, candy-bright hues with strong glow — well separated around the colour
// wheel so they stay readable even at 6 colours.
export const EGG_COLORS = [
  { key: 'red',    shell: '#ff2e63', spot: '#a3052f', glow: '#ff9bb6' },
  { key: 'gold',   shell: '#ffc814', spot: '#cf8400', glow: '#ffe98a' },
  { key: 'green',  shell: '#1fe06f', spot: '#0a8c42', glow: '#9dffc1' },
  { key: 'blue',   shell: '#1fa8ff', spot: '#0a57bd', glow: '#9ddcff' },
  { key: 'purple', shell: '#b15cff', spot: '#6a1fd0', glow: '#e0b8ff' },
  { key: 'orange', shell: '#ff7b1f', spot: '#bf4a05', glow: '#ffc48f' },
];

// Hex/offset grid. Even rows have `cols` cells; odd rows have `cols-1`, shifted
// right by half a cell (classic brick packing).
export const GRID = {
  cols: 8,      // columns on even rows
  cellD: 52,    // spacing between egg centres
  R: 25,        // egg visual radius (< cellD/2 leaves a small gap)
  marginX: 14,  // side wall inset
  topY: 64,     // ceiling y (just under the HUD top bar)
  rowH: 45,     // ≈ cellD * 0.866 (hex vertical pitch)
};

export const SHOT_SPEED = 1080; // px/s projectile speed — punchy, snappy shots
