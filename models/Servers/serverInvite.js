const mongoose = require("mongoose");

const serverInviteSchema = new mongoose.Schema(
  {
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    server: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Server",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServerInvite", serverInviteSchema);
