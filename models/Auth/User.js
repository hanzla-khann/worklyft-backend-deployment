const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: false,
      required: false, // Google users may not have a username initially
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: false, // Password is not required for OAuth users
    },
    profileImg: {
      type: String,
    },
    jobTitle: {
      type: String,
    },
    googleId: {
      type: String, // Stores the Google profile ID for OAuth users
      unique: true,
      sparse: true, // Allows users without Google ID
    },
    googleAccessToken: {
      type: String,
      required: false, // To store Google's access token
    },
    googleRefreshToken: {
      type: String,
      required: false, // To store Google's refresh token
    },
    oauth: {
      type: Boolean,
      default: false, // Indicates if the user logged in via OAuth
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    onboardingDone: {
      type: Boolean,
      default: false,
    },
    friends: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Friends", default: [] },
    ],
    servers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Server", // Reference to the Server model
      },
    ],
  },
  { timestamps: true }
); // Added timestamps for createdAt and updatedAt

module.exports = mongoose.model("User", userSchema);
