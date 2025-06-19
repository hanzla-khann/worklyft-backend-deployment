const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    subject: {
        type: String,
        default: '',
        trim: true,
    },
    body: {
        type: String,
        default: '',
    },
    isBaseTemplate: {
        type: Boolean,
        default: false, // Indicates if it's one of the initial base templates
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming you have a User model
        required: true, // Every template will belong to a user
        index: true, // For efficient querying
    },
    baseTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Template', // Reference to the original base template if this is a user-edited copy
        default: null,
    },
}, { timestamps: true });

const Template = mongoose.model('Template', templateSchema);

module.exports = Template;