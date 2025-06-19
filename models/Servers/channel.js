const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true, // Channel name is mandatory
  },
  type: {
    type: String,
    enum: ["text", "voice"], // Defines allowed types for channels (either text or voice)
    required: true, // Channel type is mandatory
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Server", // References the Server model for the server this channel belongs to
    required: true, // Channel must belong to a server
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically sets the creation date
  },
});

module.exports = mongoose.model("Channel", channelSchema);


// const mongoose = require("mongoose");

// const channelSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true, // Channel name is mandatory
//   },
//   type: {
//     type: String,
//     enum: ["text", "voice"], // Defines allowed types for channels
//     required: true, // Channel type is mandatory
//   },
//   server: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Server", // References the Server model
//     required: true, // Channel must belong to a server
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now, // Automatically sets the creation date
//   },
// });

// module.exports = mongoose.model("Channel", channelSchema);
