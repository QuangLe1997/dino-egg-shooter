import { STORAGE, DAILY_REWARDS } from '../config/constants.js';
import { SaveManager } from './SaveManager.js';

class _EconomyManager {
  constructor() {
    this.coins = SaveManager.load(STORAGE.coins, 0);
    this.boosters = SaveManager.load(STORAGE.boosters, { hammer: 3, bomb: 1, freeze: 2 });
    this.daily = SaveManager.load(STORAGE.daily, { day: 0, lastClaimDate: null });
  }

  // ---- Coins ----
  addCoins(n) {
    this.coins += n;
    this._persistCoins();
    return this.coins;
  }

  spendCoins(n) {
    if (this.coins < n) return false;
    this.coins -= n;
    this._persistCoins();
    return true;
  }

  _persistCoins() {
    SaveManager.save(STORAGE.coins, this.coins);
  }

  // ---- Boosters ----
  getBoosters() { return { ...this.boosters }; }

  setBoosters(obj) {
    this.boosters = { ...obj };
    SaveManager.save(STORAGE.boosters, this.boosters);
  }

  addBooster(key, n = 1) {
    this.boosters[key] = (this.boosters[key] || 0) + n;
    SaveManager.save(STORAGE.boosters, this.boosters);
  }

  useBooster(key) {
    if (!this.boosters[key] || this.boosters[key] <= 0) return false;
    this.boosters[key] -= 1;
    SaveManager.save(STORAGE.boosters, this.boosters);
    return true;
  }

  // ---- Daily reward ----
  // returns { canClaim, day, alreadyClaimedToday, reward }
  getDailyStatus() {
    const today = new Date().toISOString().slice(0, 10);
    const last = this.daily.lastClaimDate;

    let day = this.daily.day;
    let alreadyClaimedToday = false;
    let newDay = day;

    if (!last) {
      newDay = 1;
    } else if (last === today) {
      alreadyClaimedToday = true;
      newDay = day; // keep
    } else {
      // check if consecutive
      const lastDate = new Date(last);
      const todayDate = new Date(today);
      const diffDays = Math.round((todayDate - lastDate) / 86400000);
      if (diffDays === 1) {
        newDay = day >= 7 ? 1 : day + 1;
      } else {
        newDay = 1; // reset streak
      }
    }

    return {
      canClaim: !alreadyClaimedToday,
      day: alreadyClaimedToday ? day : newDay,
      alreadyClaimedToday,
      reward: DAILY_REWARDS[(alreadyClaimedToday ? day : newDay) - 1] || DAILY_REWARDS[0],
    };
  }

  claimDaily() {
    const status = this.getDailyStatus();
    if (!status.canClaim) return null;

    const reward = status.reward;
    const day = status.day;
    const today = new Date().toISOString().slice(0, 10);

    // apply reward
    if (reward.type === 'coin') {
      this.addCoins(reward.amount);
    } else if (reward.type === 'boost') {
      this.addBooster(reward.booster, reward.amount);
    } else if (reward.type === 'mega') {
      this.addCoins(300);
      this.addBooster('hammer', 3);
      this.addBooster('bomb', 2);
      this.addBooster('freeze', 3);
    }

    this.daily = { day, lastClaimDate: today };
    SaveManager.save(STORAGE.daily, this.daily);
    return reward;
  }
}

export const EconomyManager = new _EconomyManager();
