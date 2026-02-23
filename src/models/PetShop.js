const mongoose = require("mongoose");

const petShopSchema = new mongoose.Schema({
  items: { type: Array, default: [] },
  lastReset: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PetShop", petShopSchema);
