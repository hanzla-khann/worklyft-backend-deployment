  // services/emailService.js
  const { google } = require("googleapis");
  const User = require("../models/Auth/User"); // Import User model
  const mailcomposer = require('mailcomposer'); 

  const getGmailClient = async (userId) => {
      try {
          const user = await User.findById(userId);
          if (!user || !user.googleAccessToken || !user.googleRefreshToken) {
              throw new Error("User or tokens not found in database");
          }

          const auth = new google.auth.OAuth2();
          auth.setCredentials({
              access_token: user.googleAccessToken,
              refresh_token: user.googleRefreshToken,
          });

          // Handle token refresh
          auth.on("tokens", async (tokens) => {
              if (tokens.access_token) {
                  user.googleAccessToken = tokens.access_token;
                  await user.save(); // Save the new access token to the database
                  console.log("New access token saved to DB");
              }
              if (tokens.refresh_token) {
                  user.googleRefreshToken = tokens.refresh_token;
                  await user.save(); // Save the new refresh token
                  console.log("New refresh token saved to DB");
              }
          });

          return google.gmail({ version: "v1", auth });
      } catch (error) {
          console.error("Error getting Gmail client:", error);
          throw error;
      }
  };


exports.sendMailService = async (userId, to, cc, bcc, subject, body, isHtml = false) => {
    try {
        const gmail = await getGmailClient(userId);

        const mailOptions = {
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject,
        };

        if (cc) {
            mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
        }

        if (bcc) {
            mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;
        }

        if (isHtml) {
            mailOptions.html = body;
        } else {
            mailOptions.text = body;
        }

        const mail = mailcomposer(mailOptions);

        // Ensure mail is properly built before proceeding
        const message = await new Promise((resolve, reject) => {
            mail.build((err, message) => {
                if (err) {
                    console.error("Error building email:", err);
                    reject(err);
                    return;
                }
                resolve(message);
            });
        });

        if (!message) {
            throw new Error("Failed to build email message.");
        }

        const encodedMessage = Buffer.from(message)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedMessage,
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
};

// const getEmailBody = (payload) => {
//     let body = "";
//     if (payload.parts && payload.parts.length > 0) {
//         const textPart = payload.parts.find((part) => part.mimeType === "text/plain");
//         if (textPart && textPart.body && textPart.body.data) {
//             body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
//         } else {
//             const htmlPart = payload.parts.find((part) => part.mimeType === "text/html");
//             if (htmlPart && htmlPart.body && htmlPart.body.data) {
//                 body = Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
//             } else if (payload.body && payload.body.data) {
//                 // Fallback to the top-level body
//                 body = Buffer.from(payload.body.data, "base64").toString("utf-8");
//             }
//         }
//     } else if (payload.body && payload.body.data) {
//         // If no parts, check the top-level body
//         body = Buffer.from(payload.body.data, "base64").toString("utf-8");
//     }

//     // Basic cleanup to remove URLs and random character sequences (you might need more sophisticated logic)
//     body = body.replace(/https?:\/\/[^\s]+/g, ''); // Remove URLs
//     body = body.replace(/[^\w\s.,?!'"()/:\-]/g, ''); // Remove non-alphanumeric, non-whitespace, and some punctuation

//     return body.trim();
// };

const getEmailBody = (payload) => {
    let body = "";
    if (payload.parts && payload.parts.length > 0) {
        const htmlPart = payload.parts.find((part) => part.mimeType === "text/html");
        if (htmlPart && htmlPart.body && htmlPart.body.data) {
            // Prioritize HTML content
            body = Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
        } else {
            // Fallback to plain text if no HTML part is found
            const textPart = payload.parts.find((part) => part.mimeType === "text/plain");
            if (textPart && textPart.body && textPart.body.data) {
                body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
            } else if (payload.body && payload.body.data) {
                // Fallback to the top-level body (might be plain text)
                body = Buffer.from(payload.body.data, "base64").toString("utf-8");
            }
        }
    } else if (payload.body && payload.body.data) {
        // If no parts, check the top-level body (likely plain text)
        body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    // Remove only URLs - keep other formatting
    body = body.replace(/https?:\/\/[^\s]+/g, '');

    return body.trim();
};


exports.modifyMessageLabelsService = async (userId, messageId, labelsToAdd = [], labelsToRemove = []) => {
    try {
        const gmail = await getGmailClient(userId);
        const response = await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                addLabelIds: labelsToAdd,
                removeLabelIds: labelsToRemove,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error modifying message labels:', error);
        throw error;
    }
};

// old code without pagination
// exports.fetchEmailsService = async (userId, filter = 'INBOX') => {
//     try {
//         const gmail = await getGmailClient(userId);

//         let labelIds = [];
//         let q = '';

//         switch (filter) {
//             case 'INBOX':
//                 labelIds = ['INBOX'];
//                 break;
        //     case 'SENT':
        //         labelIds = ['SENT'];
        //         break;
        //     case 'DRAFTS':
        //         // Drafts are handled differently, no labelIds needed
        //         break;
        //     case 'STARRED':
        //         labelIds = ['STARRED'];
        //         break;
        //     case 'COMPANY':
        //         q = 'from:@preply.com';
        //         break;
        //     case 'IMPORTANT':
        //         labelIds = ['IMPORTANT'];
        //         break;
        //     case 'TRASH':
        //         labelIds = ['TRASH'];
        //         break;
        //     default:
        //         labelIds = ['INBOX']; // Default to Inbox
        // }

//         let listRes;

//         if (filter === 'DRAFTS') {
//             listRes = await gmail.users.drafts.list({
//                 userId: "me",
//             });
//         } else {
//             listRes = await gmail.users.messages.list({
//                 userId: "me",
//                 maxResults: 10, // Or your desired limit
//                 labelIds: labelIds.length > 0 ? labelIds : undefined,
//                 q: q,
//             });
//         }

//         const messages = listRes.data.messages || [];

//         const emails = await Promise.all(
//             messages.map(async (msg) => {
//                 try {
//                     const message = await gmail.users.messages.get({
//                         userId: "me",
//                         id: msg.id,
//                         format: "full",
//                     });

//                     const headers = message.data.payload.headers;
//                     const subject = headers.find((h) => h.name === "Subject")?.value;
//                     const from = headers.find((h) => h.name === "From")?.value;
//                     const dateHeader = headers.find((h) => h.name === "Date")?.value;
//                     const toHeader = filter === 'SENT' ? headers.find((h) => h.name === "To")?.value : undefined;
//                     const body = getEmailBody(message.data.payload);
//                     const isRead = !message.data.labelIds.includes('UNREAD');
//                     const isStarred = message.data.labelIds.includes('STARRED');

//                     return { id: msg.id, from, to: toHeader, subject, body, isRead, isStarred, date: dateHeader };
//                 } catch (innerError) {
//                     console.error("Error fetching email details:", innerError);
//                     return { id: msg.id, from: "Error", to: "Error", subject: "Error", body: "Error loading email", isRead: false, isStarred: false };
//                 }
//             })
//         );

//         return emails;
//     } catch (error) {
//         console.error("Error fetching emails:", error);
//         throw error;
//     }
// };

exports.fetchEmailsService = async (userId, filter = 'INBOX', page = 1, pageSize = 50) => {
    try {
        const gmail = await getGmailClient(userId);

        let labelIds = [];
        let q = '';

        switch (filter) {
            case 'INBOX':
                labelIds = ['INBOX'];
                break;
            case 'SENT':
                labelIds = ['SENT'];
                break;
            
            case 'DRAFTS':
                // Drafts are handled differently, no labelIds needed
                break;
            case 'STARRED':
                labelIds = ['STARRED'];
                break;
            case 'COMPANY':
                q = 'from:@preply.com';
                break;
            case 'IMPORTANT':
                labelIds = ['IMPORTANT'];
                break;
            case 'TRASH':
                labelIds = ['TRASH'];
                break;
            default:
                labelIds = ['INBOX']; // Default to Inbox
        }

        let listRes;

        if (filter === 'DRAFTS') {
            // Drafts might not support pagination the same way
            listRes = await gmail.users.drafts.list({
                userId: "me",
            });
        } else {
            listRes = await gmail.users.messages.list({
                userId: "me",
                maxResults: pageSize, // Use pageSize from arguments
                labelIds: labelIds.length > 0 ? labelIds : undefined,
                q: q,
                pageToken: page > 1 ? undefined : undefined, // Implement pageToken for subsequent pages if needed
            });
        }

        const messages = listRes.data.messages || [];

        const emails = await Promise.all(
            messages.map(async (msg) => {
                try {
                    const message = await gmail.users.messages.get({
                        userId: "me",
                        id: msg.id,
                        format: "full",
                    });

                    const headers = message.data.payload.headers;
                    const subject = headers.find((h) => h.name === "Subject")?.value;
                    const from = headers.find((h) => h.name === "From")?.value;
                    const dateHeader = headers.find((h) => h.name === "Date")?.value;
                    const toHeader = filter === 'SENT' ? headers.find((h) => h.name === "To")?.value : undefined;
                    const body = getEmailBody(message.data.payload);
                    const isRead = !message.data.labelIds.includes('UNREAD');
                    const isStarred = message.data.labelIds.includes('STARRED');

                    return { id: msg.id, from, to: toHeader, subject, body, isRead, isStarred, date: dateHeader };
                } catch (innerError) {
                    console.error("Error fetching email details:", innerError);
                    return { id: msg.id, from: "Error", to: "Error", subject: "Error", body: "Error loading email", isRead: false, isStarred: false };
                }
            })
        );

        return { emails, nextPageToken: listRes.data.nextPageToken }; // Return emails and the next page token
    } catch (error) {
        console.error("Error fetching emails:", error);
        throw error;
    }
};


exports.deleteEmailService = async (userId, messageId) => {
    try {
        const gmail = await getGmailClient(userId);

        await gmail.users.messages.trash({
            userId: "me",
            id: messageId,
        });
    } catch (error) {
        console.error("Error deleting email:", error);
        throw error;
    }
};


//   const getEmailBody = (payload) => {
//     let body = "";
//     if (payload.parts && payload.parts.length > 0) {
//         const textPart = payload.parts.find((part) => part.mimeType === "text/plain");
//         if (textPart && textPart.body && textPart.body.data) {
//             body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
//         } else {
//             const htmlPart = payload.parts.find((part) => part.mimeType === "text/html");
//             if (htmlPart && htmlPart.body && htmlPart.body.data) {
//                 body = Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
//             } else if (payload.body && payload.body.data) {
//                 // Fallback to the top-level body
//                 body = Buffer.from(payload.body.data, "base64").toString("utf-8");
//             }
//         }
//     } else if (payload.body && payload.body.data) {
//         // If no parts, check the top-level body
//         body = Buffer.from(payload.body.data, "base64").toString("utf-8");
//     }
//     return body;
// };



// exports.fetchEmailsService = async (userId, filter = 'INBOX') => {
//     try {
//         const gmail = await getGmailClient(userId);

//         let labelIds = [];
//         let q = '';

//         switch (filter) {
//             case 'INBOX':
//                 labelIds = ['INBOX'];
//                 break;
//             case 'SENT':
//                 labelIds = ['SENT'];
//                 break;
//             case 'DRAFTS':
//                 // Drafts are handled differently, no labelIds needed
//                 break;
//             case 'STARRED':
//                 labelIds = ['STARRED'];
//                 break;
//             case 'COMPANY':
//                 q = 'from:@preply.com';
//                 break;
//             case 'IMPORTANT':
//                  labelIds = ['IMPORTANT'];
//                  break;
//             case 'TRASH':
//                  labelIds = ['TRASH'];
//                  break;
//             default:
//                 labelIds = ['INBOX']; // Default to Inbox
//         }

//         let listRes;

//         if (filter === 'DRAFTS') {
//             listRes = await gmail.users.drafts.list({
//                 userId: "me",
//             });
//         } else {
//             listRes = await gmail.users.messages.list({
//                 userId: "me",
//                 maxResults: 10, // Or your desired limit
//                 labelIds: labelIds.length > 0 ? labelIds : undefined,
//                 q: q,
//             });
//         }

//         const messages = listRes.data.messages || [];

//         const emails = await Promise.all(
//             messages.map(async (msg) => {
//                 try {
//                     const message = await gmail.users.messages.get({
//                         userId: "me",
//                         id: msg.id,
//                         format: "full",
//                     });

//                     const headers = message.data.payload.headers;
//                     const subject = headers.find((h) => h.name === "Subject")?.value;
//                     const from = headers.find((h) => h.name === "From")?.value;
//                     const body = getEmailBody(message.data.payload);

//                     return { id: msg.id, from, subject, body };
//                 } catch (innerError) {
//                     console.error("Error fetching email details:", innerError);
//                     return { id: msg.id, from: "Error", subject: "Error", body: "Error loading email" };
//                 }
//             })
//         );

//         return emails;
//     } catch (error) {
//         console.error("Error fetching emails:", error);
//         throw error;
//     }
// };


 