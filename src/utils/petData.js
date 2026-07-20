// src/utils/petData.js — DỮ LIỆU HỆ THỐNG PET

// 🖼️ Chuyển emoji thành URL ảnh Twemoji (mã nguồn mở, link vĩnh viễn)
function emojiToImage(emoji) {
    const codes = [...emoji].map((c) => c.codePointAt(0).toString(16)).filter((c) => c !== "fe0f");
    return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.0.3/assets/72x72/${codes.join("-")}.png`;
}

// 🐾 8 LOÀI PET — mỗi loài 5 DẠNG TIẾN HÓA (level 1 / 30 / 60 / 90 / 120)
// base: chỉ số gốc | rarity: C thường, R hiếm, E sử thi
const SPECIES = {
    cun: {
        rarity: "C", baseName: "Cún",
        stages: [
            { emoji: "🐶", name: "Cún Con" },
            { emoji: "🐕", name: "Chó Săn" },
            { emoji: "🦮", name: "Chiến Khuyển" },
            { emoji: "🐕‍🦺", name: "Thần Khuyển" },
            { emoji: "🐺", name: "Sói Vương" },
        ],
        base: { hp: 120, atk: 22, def: 18, spd: 20 },
    },
    meo: {
        rarity: "C", baseName: "Mèo",
        stages: [
            { emoji: "🐱", name: "Mèo Con" },
            { emoji: "🐈", name: "Mèo Rừng" },
            { emoji: "🐅", name: "Hổ Con" },
            { emoji: "🐆", name: "Báo Đêm" },
            { emoji: "🦁", name: "Sư Tử Vương" },
        ],
        base: { hp: 100, atk: 26, def: 14, spd: 26 },
    },
    tho: {
        rarity: "C", baseName: "Thỏ",
        stages: [
            { emoji: "🐰", name: "Thỏ Con" },
            { emoji: "🐇", name: "Thỏ Chiến" },
            { emoji: "🦫", name: "Hải Ly Đấm Bốc" },
            { emoji: "🦘", name: "Kangaroo Quyền Vương" },
            { emoji: "🦣", name: "Ma Mút Cổ Đại" },
        ],
        base: { hp: 140, atk: 16, def: 24, spd: 16 },
    },
    cao: {
        rarity: "R", baseName: "Cáo",
        stages: [
            { emoji: "🦊", name: "Hồ Ly Nhỏ" },
            { emoji: "🐺", name: "Lang Hồ" },
            { emoji: "🐻", name: "Hùng Hồ" },
            { emoji: "🐻‍❄️", name: "Băng Hùng" },
            { emoji: "🐼", name: "Thái Cực Hùng Sư" },
        ],
        base: { hp: 150, atk: 28, def: 24, spd: 22 },
    },
    chim: {
        rarity: "R", baseName: "Chim",
        stages: [
            { emoji: "🐣", name: "Chim Non" },
            { emoji: "🐤", name: "Tiểu Điểu" },
            { emoji: "🐦", name: "Phi Điểu" },
            { emoji: "🦅", name: "Đại Bàng Chúa" },
            { emoji: "🦉", name: "Cú Đêm Huyền Bí" },
        ],
        base: { hp: 110, atk: 32, def: 16, spd: 34 },
    },
    ran: {
        rarity: "R", baseName: "Rắn",
        stages: [
            { emoji: "🐍", name: "Xà Con" },
            { emoji: "🦎", name: "Thằn Lằn Độc" },
            { emoji: "🐊", name: "Ngạc Ngư" },
            { emoji: "🐲", name: "Giao Long" },
            { emoji: "🐉", name: "Độc Long Đế" },
        ],
        base: { hp: 130, atk: 30, def: 22, spd: 24 },
    },
    rong: {
        rarity: "E", baseName: "Rồng",
        stages: [
            { emoji: "🦎", name: "Long Miêu" },
            { emoji: "🦖", name: "Bạo Long" },
            { emoji: "🦕", name: "Cổ Long" },
            { emoji: "🐲", name: "Thanh Long" },
            { emoji: "🐉", name: "Thần Long Cửu Thiên" },
        ],
        base: { hp: 200, atk: 40, def: 32, spd: 24 },
    },
    phuong: {
        rarity: "E", baseName: "Phượng Hoàng",
        stages: [
            { emoji: "🐤", name: "Hỏa Điểu Non" },
            { emoji: "🐓", name: "Kim Kê" },
            { emoji: "🦃", name: "Vũ Điểu" },
            { emoji: "🦚", name: "Khổng Tước" },
            { emoji: "🦩", name: "Phượng Hoàng Bất Tử" },
        ],
        base: { hp: 170, atk: 44, def: 24, spd: 32 },
    },
};

const RARITY_INFO = {
    C: { label: "⚪ Thường", mult: 1.0 },
    R: { label: "🔵 Hiếm", mult: 1.35 },
    E: { label: "🌈 Sử Thi", mult: 1.9 },
};

// 🥚 3 LOẠI TRỨNG — tỉ lệ ra loài theo độ hiếm
const EGGS = {
    thuong: { name: "🥚 Trứng Thường", price: 200000, weights: { C: 80, R: 19, E: 1 } },
    vang: { name: "🌟 Trứng Vàng", price: 1000000, weights: { C: 40, R: 50, E: 10 } },
    huyenthoai: { name: "💎 Trứng Huyền Thoại", price: 5000000, weights: { C: 5, R: 55, E: 40 } },
};

// 🍖 THỨC ĂN
const FOODS = {
    banhquy: { name: "🍪 Bánh Quy", price: 20000, exp: 60 },
    thit: { name: "🍖 Thịt Nướng", price: 80000, exp: 300 },
    daitiec: { name: "🍱 Đại Tiệc Hoàng Gia", price: 300000, exp: 1500 },
};

const MAX_PETS = 6;
const MAX_LEVEL = 120;
const EVOLVE_LEVELS = [30, 60, 90, 120]; // Mốc tiến hóa

// EXP cần để lên cấp tiếp theo
const expNeeded = (level) => level * 120;

// Dạng tiến hóa hiện tại theo level (0-4)
function stageOf(level) {
    let s = 0;
    for (const lv of EVOLVE_LEVELS) if (level >= lv) s++;
    return s;
}

// 🎲 Nở trứng: random loài theo trọng số + chỉ số IV ngẫu nhiên 85%-115%
function hatchEgg(eggType) {
    const egg = EGGS[eggType];
    const roll = Math.random() * 100;
    let rarity = "C", acc = 0;
    for (const [r, w] of Object.entries(egg.weights)) {
        acc += w;
        if (roll < acc) { rarity = r; break; }
    }
    const pool = Object.entries(SPECIES).filter(([, s]) => s.rarity === rarity);
    const [speciesId] = pool[Math.floor(Math.random() * pool.length)];
    const iv = +(0.85 + Math.random() * 0.3).toFixed(3);
    return {
        id: Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36),
        species: speciesId,
        level: 1,
        exp: 0,
        iv,
        bornAt: Date.now(),
        wins: 0,
        losses: 0,
    };
}

// 📊 Chỉ số thực của pet = gốc × rarity × IV × tăng theo level × bonus tiến hóa (x1.25/dạng)
function petStats(pet) {
    const sp = SPECIES[pet.species];
    const rMult = RARITY_INFO[sp.rarity].mult;
    const lvMult = 1 + (pet.level - 1) * 0.03;
    const stMult = Math.pow(1.25, stageOf(pet.level));
    const f = (v) => Math.round(v * rMult * pet.iv * lvMult * stMult);
    return { hp: f(sp.base.hp), atk: f(sp.base.atk), def: f(sp.base.def), spd: f(sp.base.spd) };
}

// ⚡ Lực chiến tổng
function petPower(pet) {
    const s = petStats(pet);
    return Math.round(s.hp * 0.5 + s.atk * 3 + s.def * 2 + s.spd * 2.5);
}

// Thông tin hiển thị dạng hiện tại
function petDisplay(pet) {
    const sp = SPECIES[pet.species];
    const st = sp.stages[stageOf(pet.level)];
    return { emoji: st.emoji, name: pet.nickname || st.name, formName: st.name, image: emojiToImage(st.emoji), rarity: RARITY_INFO[sp.rarity].label };
}

module.exports = { SPECIES, RARITY_INFO, EGGS, FOODS, MAX_PETS, MAX_LEVEL, EVOLVE_LEVELS, expNeeded, stageOf, hatchEgg, petStats, petPower, petDisplay, emojiToImage };