require("dotenv").config();
const mongoose = require("mongoose");
const PetEvolution = require("./src/models/PetEvolution");

async function seed() {

  await mongoose.connect(process.env.MONGO_URI);

  console.log("Connected MongoDB");

  await PetEvolution.deleteMany({});

  await PetEvolution.insertMany([
    // 🔥 FIRE
    {
      petId: "fire_dragon",
      level: 1,
      image: "https://static.wikia.nocookie.net/dragoncity/images/b/b2/Heatwave_Dragon_1.png/revision/latest?cb=20240607143449"
    },
    {
      petId: "fire_dragon",
      level: 30,
      image: "https://static.wikia.nocookie.net/dragoncity/images/8/8a/Heatwave_Dragon_2.png/revision/latest?cb=20240607143513"
    },
    {
      petId: "fire_dragon",
      level: 60,
      image: "https://static.wikia.nocookie.net/dragoncity/images/0/03/Burning_Dragon_.png/revision/latest?cb=20140219112656"
    },

    // 🌊 WATER
    {
      petId: "water_dragon",
      level: 1,
      image: "YOUR_WATER_LV1_URL"
    },
    {
      petId: "water_dragon",
      level: 30,
      image: "YOUR_WATER_LV30_URL"
    },
    {
      petId: "water_dragon",
      level: 60,
      image: "YOUR_WATER_LV60_URL"
    },

    // ⚡ ELECTRIC
    {
      petId: "electric_dragon",
      level: 1,
      image: "YOUR_ELECTRIC_LV1_URL"
    },
    {
      petId: "electric_dragon",
      level: 30,
      image: "YOUR_ELECTRIC_LV30_URL"
    },
    {
      petId: "electric_dragon",
      level: 60,
      image: "YOUR_ELECTRIC_LV60_URL"
    }
  ]);

  console.log("Seed xong!");
  process.exit();
}

seed();