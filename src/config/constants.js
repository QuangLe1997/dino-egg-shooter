// Game constants & difficulty tunings (Dino Egg Pop — bubble shooter)

export const PLAY_AREA = {
  // logical (design) coordinates — renderer scales to canvas
  width: 460,
  height: 720,
};

// difficulty modes
// booster keys are reused from the shared economy: hammer = 🌈 Rainbow egg,
// bomb = 💣 Bomb shot, freeze = ⬆️ Push-back (removes the lowest row).
export const DIFFICULTY = {
  easy: {
    label: 'Easy',
    startRows: 4,        // rows pre-filled at the top
    rowEveryShots: 9,    // a new row descends every N shots
    colors: 4,           // number of egg colours in play
    dangerY: 552,        // lose if an egg centre passes this y (above the slingshot)
    coinReward: 0.7,
    startingBoosters: { hammer: 3, bomb: 2, freeze: 3 },
  },
  normal: {
    label: 'Normal',
    startRows: 5,
    rowEveryShots: 7,
    colors: 5,
    dangerY: 536,
    coinReward: 1.0,
    startingBoosters: { hammer: 2, bomb: 1, freeze: 2 },
  },
  hard: {
    label: 'Hard',
    startRows: 6,
    rowEveryShots: 5,
    colors: 6,
    dangerY: 520,
    coinReward: 1.4,
    startingBoosters: { hammer: 1, bomb: 1, freeze: 1 },
  },
};

// ads
export const AD = {
  interstitialEveryN: 3,
  maxRevivesPerGame: 1,
};

// storage keys (dino_* — separate namespace from any other game on this origin)
export const STORAGE = {
  highscore: 'dino_highscore_v1',
  coins: 'dino_coins_v1',
  settings: 'dino_settings_v1',
  daily: 'dino_daily_v1',
  ads: 'dino_ads_stats_v1',
  mode: 'dino_mode_v1',
  boosters: 'dino_boosters_v1',
};

// daily reward chain (Day 1..7)
export const DAILY_REWARDS = [
  { day: 1, type: 'coin', amount: 20 },
  { day: 2, type: 'coin', amount: 40 },
  { day: 3, type: 'boost', booster: 'freeze', amount: 1 },
  { day: 4, type: 'coin', amount: 80 },
  { day: 5, type: 'boost', booster: 'hammer', amount: 2 },
  { day: 6, type: 'coin', amount: 150 },
  { day: 7, type: 'mega', label: '🎁 MEGA: 300 🪙 + boosters' },
];
