// src/utils/cooldowns.js

const fs = require("fs");
const path = require("path");

const cooldowns = new Map();

// thời gian cooldown từng lệnh (giây)
const cooldownConfig = {
  ping: 5,
  tuimu: 3600,
  daoham: 180,
  baucua: 60,
};

// format thời gian đẹp hơn
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function checkCooldown(userId, commandName) {

  const cooldownTime = cooldownConfig[commandName];

  // nếu lệnh không có cooldown thì bỏ qua
  if (!cooldownTime) return 0;

  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(commandName);
  const cooldownAmount = cooldownTime * 1000;

  if (timestamps.has(userId)) {

    const expirationTime = timestamps.get(userId) + cooldownAmount;

    if (now < expirationTime) {

      const timeLeft = (expirationTime - now) / 1000;

      return formatTime(timeLeft);
    }

  }

  timestamps.set(userId, now);

  setTimeout(() => {
    timestamps.delete(userId);
  }, cooldownAmount);

  return 0;
}

module.exports = {
  checkCooldown,
  cooldownConfig
};
