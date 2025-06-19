const express = require('express');
const router = express.Router();
const Template = require('../models/Mail/Template');

// Helper function to create initial base templates for a user
async function createBaseTemplates(userId) {
    // const baseTemplatesData = [
    //     { name: 'Welcome Email', subject: 'Welcome to our platform!', body: 'Hi [User Name], welcome aboard!' },
    //     { name: 'Password Reset', subject: 'Reset your password', body: 'Click here to reset: [Reset Link]' },
    //     { name: 'Order Confirmation', subject: 'Your order has been placed', body: 'Thank you for your order!' },
    //     { name: 'Shipping Update', subject: 'Your order is on its way', body: 'Your order is expected to arrive by [Date].' },
    //     { name: 'Feedback Request', subject: 'We\'d love your feedback!', body: 'Tell us about your experience.' },
    //     { name: 'Newsletter Signup Confirmation', subject: 'You\'re subscribed to our newsletter!', body: 'Stay tuned for updates!' },
    //     { name: 'Account Activation', subject: 'Activate your account', body: 'Click the link to activate: [Activation Link]' },
    //     { name: 'Event Invitation', subject: 'You\'re invited!', body: 'Join us for our upcoming event on [Date].' },
    //     { name: 'Reminder', subject: 'Friendly Reminder', body: 'Just a reminder about [Details].' },
    //     { name: 'Thank You', subject: 'Thank You!', body: 'Thank you for your support!' },
    // ];
    const baseTemplatesData = [
        {
            name: 'Project Assignment',
            subject: 'You have been assigned a new project: [Project Name]',
            body: 'Hi [User Name],\n\nYou have been assigned to the project "[Project Name]". Please review the project details and objectives in the WorkLyft dashboard. Your first task will be to [First Task/Objective].\n\nIf you have any questions, feel free to reach out to [Manager Name] or reply to this message.\n\nLet’s collaborate and achieve great results together!\n\nBest regards,\n[Your Company Name]'
        },
        {
            name: 'Task Update',
            subject: 'Update on your assigned task: [Task Name]',
            body: 'Hi [User Name],\n\nWe wanted to inform you that there has been an update regarding the task "[Task Name]".\n\n[Update Details: e.g., Deadline changed to [New Date], Priority updated to [Priority Level], Comments added by [Teammate Name]].\n\nPlease review the updates and adjust your workflow accordingly. If further clarification is needed, you can check the task comments or reach out directly through WorkLyft chat.\n\nThanks for staying proactive!\n\nRegards,\n[Team/Project Manager]'
        },
        {
            name: 'Meeting Reminder',
            subject: 'Upcoming Meeting Scheduled: [Meeting Topic]',
            body: 'Hello [User Name],\n\nThis is a friendly reminder about the upcoming meeting on [Date] at [Time] regarding "[Meeting Topic]".\n\n**Agenda:**\n- [Agenda Point 1]\n- [Agenda Point 2]\n- [Agenda Point 3]\n\nPlease ensure you review the relevant documents beforehand and come prepared with any updates or questions.\n\nMeeting Link: [Meeting Link]\n\nSee you there!\n\nBest,\n[Organizer Name]'
        },
        {
            name: 'New Message Notification',
            subject: 'You have received a new message from [Sender Name]',
            body: 'Hi [User Name],\n\nYou have a new message from [Sender Name] regarding [Topic/Project Name].\n\n**Message Preview:**\n"[Short Message Snippet]"\n\nTo read and reply to the full message, please visit your WorkLyft inbox.\n\nStay connected and keep the momentum going!\n\nThanks,\nWorkLyft Notifications'
        },
        {
            name: 'Deadline Reminder',
            subject: 'Reminder: Deadline Approaching for [Task or Project Name]',
            body: 'Hi [User Name],\n\nThis is a reminder that the deadline for "[Task or Project Name]" is fast approaching.\n\n**Due Date:** [Due Date]\n**Current Status:** [Task Status]\n\nPlease make sure any pending work is completed by the due date. If you anticipate any delays or need assistance, kindly update the task or notify your project manager as soon as possible.\n\nLet’s finish strong!\n\nBest,\n[Team Name]'
        },
        {
            name: 'Team Announcement',
            subject: 'Important Team Announcement: [Announcement Title]',
            body: 'Hello Team,\n\nWe are excited to share some important news: [Full Announcement Content, e.g., "We are launching a new initiative/project starting next month."].\n\nKey Points:\n- [Point 1]\n- [Point 2]\n- [Point 3]\n\nPlease stay tuned for more details. Your participation and feedback will be crucial to the success of this initiative.\n\nLet’s continue working together towards our goals!\n\nWarm regards,\n[Management/Leadership Team]'
        },
        {
            name: 'Feedback Request',
            subject: 'We value your feedback on [Project/Task]',
            body: 'Hi [User Name],\n\nWe would love to hear your thoughts about your recent experience working on [Project/Task Name].\n\n- What went well?\n- What could have been improved?\n- Any suggestions for future projects?\n\nYour input is incredibly valuable and helps us improve our processes and collaboration efforts.\n\nPlease take a few minutes to fill out [Feedback Form Link] or reply directly to this message.\n\nThank you for being a vital part of the team!\n\nBest,\n[Your Company Name]'
        },
        {
            name: 'Onboarding Instructions',
            subject: 'Welcome to [Team/Company]! Your First Steps',
            body: 'Hi [User Name],\n\nWelcome to [Company/Team Name] — we are thrilled to have you with us!\n\nHere’s how you can get started:\n1. Log into WorkLyft and set up your profile.\n2. Review your assigned onboarding tasks.\n3. Attend the onboarding meeting scheduled for [Date & Time].\n4. Read the team handbook [Handbook Link].\n\nIf you have any questions, your onboarding buddy [Buddy Name] is available to assist you.\n\nLooking forward to your amazing contributions!\n\nWarmly,\n[HR Team / Hiring Manager]'
        },
        {
            name: 'Weekly Summary',
            subject: 'Your Weekly Work Summary: [Week Range]',
            body: 'Hi [User Name],\n\nHere’s a quick overview of your work for the week [Week Start Date] - [Week End Date]:\n\n- Completed Tasks: [Number]\n- Pending Tasks: [Number]\n- Meetings Attended: [Number]\n- Notes: [Any Highlights]\n\nKeep up the great momentum! If you want a detailed breakdown or set new priorities, please check your dashboard or reach out to your team lead.\n\nLet’s gear up for an even better next week!\n\nCheers,\n[Your Team Lead Name]'
        },
        {
            name: 'Performance Review Notification',
            subject: 'Upcoming Performance Review – Action Required',
            body: 'Hi [User Name],\n\nAs part of our regular review cycle, it’s time to schedule your performance review for [Review Period, e.g., Q1 2025].\n\nThe review will focus on:\n- Achievements\n- Areas for improvement\n- Goal setting for the next cycle\n\nPlease use the following link to select a convenient time slot: [Scheduling Link].\n\nMake sure to prepare your self-assessment beforehand if required.\n\nWe look forward to discussing your amazing progress!\n\nSincerely,\n[Manager Name / HR Department]'
        }
    ];
    


    const createdTemplates = [];
    for (const templateData of baseTemplatesData) {
        const newTemplate = new Template({ ...templateData, isBaseTemplate: true, user: userId });
        await newTemplate.save();
        createdTemplates.push(newTemplate);
    }
    return createdTemplates;
}


const ensureBaseTemplates = async (req, res, next) => {
    try {
        const baseTemplateCount = await Template.countDocuments({ user: req.user.id, isBaseTemplate: true });
        if (baseTemplateCount < 10) {
            await createBaseTemplates(req.user.id);
        }
        next();
    } catch (error) {
        console.error("Error ensuring base templates:", error);
        res.status(500).json({ message: 'Could not ensure base templates.' });
    }
};

// Route to get all templates for the authenticated user
router.get('/', ensureBaseTemplates, async (req, res) => {
    try {
        const templates = await Template.find({ user: req.user.id }).sort({ name: 1 });
        res.json(templates);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Route to get a specific template by ID for the authenticated user
router.get('/:id', async (req, res) => {
    try {
        const template = await Template.findOne({ _id: req.params.id, user: req.user.id });
        if (!template) {
            return res.status(404).json({ message: 'Template not found or does not belong to this user.' });
        }
        res.json(template);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Route to create a new custom template for the authenticated user
router.post('/', async (req, res) => {
    const template = new Template({
        name: req.body.name,
        subject: req.body.subject,
        body: req.body.body,
        isBaseTemplate: false,
        user: req.user.id,
    });

    try {
        const newTemplate = await template.save();
        res.status(201).json(newTemplate);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Route to edit a template (creates a duplicate if it's a base template)
router.patch('/:id', async (req, res) => {
    try {
        const originalTemplate = await Template.findOne({ _id: req.params.id, user: req.user.id });
        if (!originalTemplate) {
            return res.status(404).json({ message: 'Template not found or does not belong to this user.' });
        }

        let templateToUpdate;
        let isNewDuplicate = false;

        if (originalTemplate.isBaseTemplate) {
            // Create a new duplicate template
            const newDuplicate = new Template({
                name: req.body.name || `${originalTemplate.name} (Edited)`,
                subject: req.body.subject || originalTemplate.subject,
                body: req.body.body || originalTemplate.body,
                isBaseTemplate: false,
                user: req.user.id,
                baseTemplateId: originalTemplate._id,
            });
            templateToUpdate = await newDuplicate.save();
            isNewDuplicate = true;
        } else {
            // Update the existing custom template
            originalTemplate.name = req.body.name || originalTemplate.name;
            originalTemplate.subject = req.body.subject || originalTemplate.subject;
            originalTemplate.body = req.body.body || originalTemplate.body;
            templateToUpdate = await originalTemplate.save();
        }

        res.json(templateToUpdate);

    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Route to reset a template to its base version
router.post('/:id/reset', async (req, res) => {
    try {
        const userEditedTemplate = await Template.findOne({ _id: req.params.id, user: req.user.id, isBaseTemplate: false, baseTemplateId: { $ne: null } });
        if (!userEditedTemplate) {
            return res.status(404).json({ message: 'Editable template not found or is not a modified base template.' });
        }

        const baseTemplate = await Template.findById(userEditedTemplate.baseTemplateId);
        if (!baseTemplate) {
            return res.status(404).json({ message: 'Original base template not found.' });
        }

        userEditedTemplate.name = baseTemplate.name;
        userEditedTemplate.subject = baseTemplate.subject;
        userEditedTemplate.body = baseTemplate.body;

        const resetTemplate = await userEditedTemplate.save();
        res.json(resetTemplate);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Route to delete a template by ID for the authenticated user
router.delete('/:id', async (req, res) => {
    try {
        const template = await Template.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!template) {
            return res.status(404).json({ message: 'Template not found or does not belong to this user.' });
        }
        res.json({ message: 'Template deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;