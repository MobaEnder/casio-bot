const User = require("../models/User");

module.exports = async function checkLoans(client) {
  const overdue = await User.find({
    "loan.active": true,
    "loan.dueAt": { $lt: new Date() },
  });

  for (const user of overdue) {
    user.loan.active = false;
    user.loan.amount = 0;
    user.loan.from = null;
    user.loan.dueAt = null;
    user.banned = true; // dùng để chặn cược
    await user.save();

    try {
      const discordUser = await client.users.fetch(user.userId);
      await discordUser.send(
        "⛔ Bạn đã quá hạn trả nợ và bị **CẤM VĨNH VIỄN** khỏi hệ thống cược!"
      );
    } catch {}
  }
};
