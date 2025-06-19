const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    channelID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      default: null,
    },
    senderID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    text: String,
    filePath: String,
    isFile: {
      type: Boolean,
      default: false,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    edited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationID: 1 });
MessageSchema.index({ channelID: 1 });

const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;
