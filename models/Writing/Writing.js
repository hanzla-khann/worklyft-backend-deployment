const mongoose = require("mongoose");

const WritingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    //author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    author: { type: String, required: true },
    shared: { type: Boolean, default: false },
    sharedLink: { type: String, default: "" },
    template: { type: Boolean, default: false },
  },
  { timestamps: true }
);


const Writing = mongoose.model("Writing", WritingSchema);
module.exports = Writing;