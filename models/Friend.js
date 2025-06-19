const mongoose = require("mongoose");

const FriendshipSchema = new mongoose.Schema({
  requestor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: { type: String, enum: ["pending", "friends", "blocked"] },
});

const Friendship = mongoose.model("Friends", FriendshipSchema);

module.exports = Friendship;
