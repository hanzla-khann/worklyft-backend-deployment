const sequelize = require("../../config/sequelize");
const { DataTypes } = require("sequelize");
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: "5m",
  },
});

const OTP = mongoose.model("OTP", otpSchema);

// const OTP = sequelize.define(
//   "OTP",
//   {
//     otp: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     createdAt: {
//       type: DataTypes.DATE,
//       allowNull: false,
//       defaultValue: DataTypes.NOW,
//     },
//   },
//   {
//     timestamps: false,
//   }
// );

module.exports = OTP;
