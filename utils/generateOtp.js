const nodemailer = require("nodemailer");
const randomstring = require("randomstring");

const OTP = require("../models/Auth/OTP");

function generateOtp() {
  return randomstring.generate({
    length: 6,
    charset: "numeric",
  });
}

async function sendOtp(to) {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    authMethod: "LOGIN",
  });

  const otp = generateOtp();
  await saveOtpInDB(otp);

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: to,
    subject: "One Time Password (OTP) for WorkLyft",
    html: `Your One Time Password is ${otp}`,
  });
}

async function saveOtpInDB(otp) {
  try {
    await OTP.create({
      otp: otp,
    });
  } catch (error) {
    console.log("Error creating OTP");
  }
}

module.exports = { sendOtp };
