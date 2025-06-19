const mongoose = require('mongoose');

const dashCommentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Add userId, reference the User model
    title: { type: String, required: true },
    description: { type: String, required: true },
    tag: { type: String, enum: ['Urgent', 'High Priority', 'General'], default: 'Urgent' },
    createdAt: { type: Date, default: Date.now },
});

const DashComment = mongoose.model('DashComment', dashCommentSchema);
module.exports = DashComment;