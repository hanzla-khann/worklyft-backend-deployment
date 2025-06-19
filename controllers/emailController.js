// controllers/emailController.js
const Email = require("../models/Mail/Email");
const {
    sendMailService,
    fetchEmailsService,
    deleteEmailService,
    modifyMessageLabelsService,
    getGmailClient,
} = require("../services/emailService");


exports.sendEmail = async (req, res) => {
    const user = req.user; // User from verifyTokens middleware
    const { to, cc, bcc, subject, body, isHtml } = req.body;

    if (!user || !user.id) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const response = await sendMailService(user.id, to, cc, bcc, subject, body, isHtml);

        const email = new Email({
            to: to ? (Array.isArray(to) ? to.join(', ') : to) : '',
            cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : '',
            bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : '',
            subject,
            body,
            gmailMessageId: response.id,
            status: "sent",
            userId: user.id,
        });

        await email.save();

        res.status(200).json({ message: "Email sent successfully!", response });
    } catch (error) {
        console.error("Email sending error:", error);
        res.status(500).json({ message: "Failed to send email", error: error.message });
    }
};


exports.getEmails = async (req, res) => {
    const user = req.user;
    const filter = req.query.filter; // Get the filter from the query parameters

    if (!user || !user.id) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const emails = await fetchEmailsService(user.id, filter);
        res.status(200).json(emails);
    } catch (error) {
        console.error("Error in getEmails:", error);
        res.status(500).json({ message: "Error fetching emails", error: error.message });
    }
};


exports.deleteEmail = async (req, res) => {
    const user = req.user;
    const { id } = req.params;

    if (!user || !user.id) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        await deleteEmailService(user.id, id);
        await Email.findOneAndUpdate({ gmailMessageId: id, userId: user.id }, { status: 'trash' });
        res.status(200).json({ message: "Email moved to trash successfully" });
    } catch (error) {
        console.error("Error moving email to trash:", error);
        res.status(500).json({ message: "Error moving email to trash", error: error.message });
    }
};

// new code
exports.markAsRead = async (req, res) => {
    const user = req.user;
    const { id } = req.params;

    if (!user || !user.id) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        await modifyMessageLabelsService(user.id, id, [], ['UNREAD']);
        // Optionally update your local database as well
        res.status(200).json({ message: "Email marked as read" });
    } catch (error) {
        console.error("Error marking email as read:", error);
        res.status(500).json({ message: "Error marking email as read", error: error.message });
    }
};

exports.starEmail = async (req, res) => {
    const user = req.user;
    const { id } = req.params;

    if (!user || !user.id) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const email = await Email.findOne({ gmailMessageId: id, userId: user.id });
        if (!email) {
            return res.status(404).json({ message: "Email not found" });
        }

        // Assume a toggle: if it's not starred in our DB, we star it; otherwise, we unstar.
        const shouldStar = !email.isStarred;
        const labelsToAdd = shouldStar ? ['STARRED'] : [];
        const labelsToRemove = shouldStar ? [] : ['STARRED'];

        // Modify the labels in Gmail
        await modifyMessageLabelsService(user.id, id, labelsToAdd, labelsToRemove);

        // Update the local database's isStarred field to reflect the change in Gmail
        await Email.findOneAndUpdate(
            { gmailMessageId: id, userId: user.id },
            { isStarred: shouldStar }
        );

        res.status(200).json({ message: `Email ${shouldStar ? 'starred' : 'unstarred'}` });
    } catch (error) {
        console.error("Error starring/unstaring email:", error);
        res.status(500).json({ message: "Error starring/unstaring email", error: error.message });
    }
};