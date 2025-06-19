const mongoose = require("mongoose");

const serverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true, // Server name is mandatory
  },
  description: {
    type: String,
  },
  profileImg: {
    type: String,
    required: false,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  members: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      roles: [
        {
          type: String,
          default: "Member",
        },
      ],
    },
  ],
  textChannels: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel", // Reference to the Channel model for text channels
    },
  ],
  voiceChannels: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel", // Reference to the Channel model for voice channels
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now, // Automatically sets the creation date
  },
});

module.exports = mongoose.model("Server", serverSchema);
