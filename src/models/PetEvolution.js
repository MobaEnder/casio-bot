const mongoose = require("mongoose");

const petEvolutionSchema = new mongoose.Schema({
  petId: { type: String, required: true }, // fire_dragon
  level: { type: Number, required: true }, // 1 / 30 / 60
  image: { type: String, required: true },
  name: { type: String },
  bonusStats: {
    hp: Number,
    atk: Number,
    def: Number,
    spd: Number
  }
});

module.exports = mongoose.model("PetEvolution", petEvolutionSchema);