 // models/Mail/Email.js
 const mongoose = require("mongoose");

 const emailSchema = new mongoose.Schema(
     {
         to: String,
         from: String,
         subject: String,
         body: String,
         gmailMessageId: String, // Store Gmail message ID
         status: String,
         userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
     },
     { timestamps: true }
 );

 module.exports = mongoose.model("Email", emailSchema);


// const mongoose = require("mongoose");

// const emailSchema = new mongoose.Schema({
//     to: { type: String, required: true },
//     subject: { type: String, required: true },
//     body: { type: String, required: true },
//     status: { type: String, enum: ["sent", "failed"], default: "sent" },
//     createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("Email", emailSchema);
