const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the User model
    title: { type: String, required: true },
    whoWith: { type: String, required: true },
    dateTime: { type: Date, required: true },
    location: { type: String, required: true },
    googleEventId: { type: String }, // Store Google Calendar event ID
    recipientType: { type: String, enum: ['email', 'worklyft'], default: 'email' },
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
});

const Appointment = mongoose.model('Appointment', appointmentSchema);
module.exports = Appointment;
