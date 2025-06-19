const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    priority: String,
    server: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Server",
    },
    status: {
      type: String,
      default: "Pending",
    },
    deadline: Date,
    milestones: [{}],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    assignedMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: String,
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, versionKey: false }
);

const Task = mongoose.model("Task", TaskSchema);

module.exports = Task;
