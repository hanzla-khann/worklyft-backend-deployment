const mongoose = require("mongoose");

const ReactSchema = new mongoose.Schema(
  {
    type: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    count: Number,
  },
  { _id: false, versionKey: false }
);

const CommentSchema = new mongoose.Schema(
  {
    text: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    edited: {
      type: Boolean,
      default: false,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    reacts: [ReactSchema],
  },
  { timestamps: true, versionKey: false }
);

const Comment = mongoose.model("Comment", CommentSchema);

module.exports = Comment;
