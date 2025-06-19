    // routes/email.js
    const express = require("express");
    const {
        sendEmail,
        getEmails,
        deleteEmail,
        markAsRead, // Import the new controller function
        starEmail,
    } = require("../controllers/emailController");
    const { verifyTokens } = require("./auth"); // Adjust the path as necessary
    const router = express.Router();

    router.post("/send", verifyTokens, sendEmail);
    router.get("/emails", verifyTokens, getEmails);
    router.delete("/delete/:id", verifyTokens, deleteEmail);
    router.post("/markasread/:id", verifyTokens, markAsRead); // New route
    router.post("/star/:id", verifyTokens, starEmail);    

    module.exports = router;





