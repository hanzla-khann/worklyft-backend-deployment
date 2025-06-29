const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: String,
    server: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Server",
      required: true,
    },
    hostRoomCode: String,
    guestRoomCode: String,
    status: String,
    // Recording and transcription fields
    recordingId: String,
    recordingStatus: {
      type: String,
      enum: ["not_started", "starting", "started", "running", "stopped", "failed", "completed"],
      default: "not_started"
    },
    actualDuration: Number, // Duration in seconds from 100ms webhook
    transcription: {
      enabled: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["not_started", "processing", "completed", "failed"],
        default: "not_started"
      },
      transcriptionId: String,
      transcript: String,
      summary: {
        agenda: [String],
        keyPoints: [String],
        actionItems: [String],
        shortSummary: String,
        speakers: [String]
      },
      rawSummary: mongoose.Schema.Types.Mixed, // Store raw summary data for debugging
      assets: {
        txt: String,
        srt: String,
        json: String
      }
    },
    roomId: String, // Store the 100ms room ID for recording operations
  },
  { timestamps: true }
);

const Meeting = mongoose.model("Meeting", meetingSchema);
module.exports = Meeting;
