const express = require('express');
const mongoose = require('mongoose');
const Appointment = require("../../models/Dashboard/Appointments"); 
const { google } = require('googleapis');
const User = require('../../models/Auth/User');

const router = express.Router();

const getUserId = (req) => {
    if (req.user && req.user.id) {
        return req.user.id;
    } else if (req.cookies && req.cookies.userId) {
        return req.cookies.userId;
    } else {
        return null;
    }
};

async function refreshGoogleToken(user) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            "458898494944-2unrnoldtgo1augmdgs3q9030tgelarf.apps.googleusercontent.com",
            "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",
            process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback'
        );
        
        oauth2Client.setCredentials({
            refresh_token: user.googleRefreshToken
        });
        
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        user.googleAccessToken = credentials.access_token;
        if (credentials.refresh_token) {
            user.googleRefreshToken = credentials.refresh_token;
        }
        await user.save();
        
        return credentials.access_token;
    } catch (error) {
        throw error;
    }
}

router.post('/check-conflict', async (req, res) => {
    try {
        const userId = getUserId(req);
        
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const { recipientUserId, dateTime } = req.body;
        
        if (!recipientUserId || !dateTime) {
            return res.status(400).json({ message: 'Recipient user ID and date/time are required' });
        }

        if (!mongoose.Types.ObjectId.isValid(recipientUserId)) {
            return res.status(400).json({ message: 'Invalid recipient user ID format' });
        }

        const appointmentDateTime = new Date(dateTime);
        
        if (isNaN(appointmentDateTime.getTime())) {
            return res.status(400).json({ message: 'Invalid date/time format' });
        }
        
        const conflictStart = new Date(appointmentDateTime.getTime() - 30 * 60000);
        const conflictEnd = new Date(appointmentDateTime.getTime() + 30 * 60000);

        const conflictingAppointment = await Appointment.findOne({
            $or: [
                { userId: recipientUserId },
                { recipientUserId: recipientUserId }
            ],
            dateTime: {
                $gte: conflictStart,
                $lte: conflictEnd
            }
        });

        if (conflictingAppointment) {
            return res.json({
                hasConflict: true,
                conflictingAppointment: {
                    title: conflictingAppointment.title,
                    dateTime: conflictingAppointment.dateTime,
                    location: conflictingAppointment.location
                }
            });
        }

        res.json({ hasConflict: false });
    } catch (error) {
        res.status(500).json({ 
            message: 'Error checking appointment conflict',
            error: error.message 
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const appointments = await Appointment.find({ userId }).sort({ dateTime: 1 });
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const { title, whoWith, dateTime, location, googleEventId, recipientType, recipientUserId } = req.body;
        if (!title || !whoWith || !dateTime || !location) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const organizerAppointment = new Appointment({
            userId,
            title,
            whoWith,
            dateTime,
            location,
            googleEventId,
            recipientType: recipientType || 'email',
            recipientUserId
        });

        const newOrganizerAppointment = await organizerAppointment.save();

        if (recipientType === 'worklyft' && recipientUserId) {
            try {
                const organizer = await User.findById(userId).select('username email');
                
                const recipientAppointment = new Appointment({
                    userId: recipientUserId,
                    title: title,
                    whoWith: organizer ? organizer.email : 'Unknown User',
                    dateTime,
                    location,
                    googleEventId,
                    recipientType: 'email',
                    recipientUserId: userId
                });

                await recipientAppointment.save();
            } catch (recipientError) {
            }
        }

        res.status(201).json(newOrganizerAppointment);
    } catch (err) {
        res.status(400).json({ message: 'Error creating appointment' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const { title, whoWith, dateTime, location, googleEventId, recipientType, recipientUserId } = req.body;
        if (!title || !whoWith || !dateTime || !location) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized: Not your appointment' });
        }

        const oldRecipientType = appointment.recipientType;
        const oldRecipientUserId = appointment.recipientUserId;
        const oldDateTime = appointment.dateTime;
        const oldTitle = appointment.title;
        const oldLocation = appointment.location;

        const user = await User.findById(userId);
        if (!user || !user.googleAccessToken) {
            return res.status(403).json({ message: 'Google Calendar access not available' });
        }

        const oauth2Client = new google.auth.OAuth2(
            "458898494944-2unrnoldtgo1augmdgs3q9030tgelarf.apps.googleusercontent.com",
            "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",
            process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback'
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        try {
            if (appointment.googleEventId) {
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                
                let userTimeZone = 'UTC';
                try {
                    const settingsResponse = await calendar.settings.get({
                        setting: 'timezone'
                    });
                    userTimeZone = settingsResponse.data.value || 'UTC';
                } catch (err) {
                }

                const startDateTime = new Date(dateTime);
                const endDateTime = new Date(startDateTime);
                endDateTime.setMinutes(startDateTime.getMinutes() + 60);

                const eventDetails = {
                    summary: title,
                    location: location,
                    description: `Appointment with ${whoWith}`,
                    start: {
                        dateTime: startDateTime.toISOString(),
                        timeZone: userTimeZone
                    },
                    end: {
                        dateTime: endDateTime.toISOString(),
                        timeZone: userTimeZone
                    },
                    attendees: [
                        { email: whoWith, responseStatus: 'needsAction' },
                        { email: user.email, responseStatus: 'accepted' }
                    ],
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'email', minutes: 24 * 60 },
                            { method: 'popup', minutes: 30 }
                        ]
                    }
                };

                await calendar.events.update({
                    calendarId: 'primary',
                    eventId: appointment.googleEventId,
                    resource: eventDetails,
                    sendUpdates: 'all'
                });
            }

            appointment.title = title;
            appointment.whoWith = whoWith;
            appointment.dateTime = dateTime;
            appointment.location = location;
            appointment.recipientType = recipientType || appointment.recipientType;
            appointment.recipientUserId = recipientUserId;
            if (googleEventId) {
                appointment.googleEventId = googleEventId;
            }

            const updatedAppointment = await appointment.save();

            if (oldRecipientType === 'worklyft' && oldRecipientUserId) {
                try {
                    const recipientAppointment = await Appointment.findOne({
                        userId: oldRecipientUserId,
                        recipientUserId: userId,
                        dateTime: oldDateTime,
                        title: oldTitle,
                        location: oldLocation
                    });

                    if (recipientAppointment) {
                        if (recipientType === 'worklyft' && recipientUserId && recipientUserId === oldRecipientUserId.toString()) {
                            recipientAppointment.title = title;
                            recipientAppointment.dateTime = dateTime;
                            recipientAppointment.location = location;
                            await recipientAppointment.save();
                        } else {
                            await recipientAppointment.deleteOne();
                            
                            if (recipientType === 'worklyft' && recipientUserId) {
                                const organizer = await User.findById(userId).select('username email');
                                const newRecipientAppointment = new Appointment({
                                    userId: recipientUserId,
                                    title: title,
                                    whoWith: organizer ? organizer.email : 'Unknown User',
                                    dateTime,
                                    location,
                                    googleEventId,
                                    recipientType: 'email',
                                    recipientUserId: userId
                                });
                                await newRecipientAppointment.save();
                            }
                        }
                    }
                } catch (recipientError) {
                }
            } else if (recipientType === 'worklyft' && recipientUserId) {
                try {
                    const organizer = await User.findById(userId).select('username email');
                    const newRecipientAppointment = new Appointment({
                        userId: recipientUserId,
                        title: title,
                        whoWith: organizer ? organizer.email : 'Unknown User',
                        dateTime,
                        location,
                        googleEventId,
                        recipientType: 'email',
                        recipientUserId: userId
                    });
                    await newRecipientAppointment.save();
                } catch (recipientError) {
                }
            }

        res.json(updatedAppointment);
        
        } catch (apiError) {
            if (apiError.code === 401 || apiError.code === 403 || 
                (apiError.response && (apiError.response.status === 401 || apiError.response.status === 403))) {
                
                if (!user.googleRefreshToken) {
                    return res.status(401).json({
                        message: 'Google access token expired and no refresh token available',
                        details: 'Please reconnect your Google account'
                    });
                }
                
                try {
                    const newAccessToken = await refreshGoogleToken(user);
                    
                    oauth2Client.setCredentials({
                        access_token: newAccessToken,
                        refresh_token: user.googleRefreshToken
                    });
                    
                    if (appointment.googleEventId) {
                        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                        await calendar.events.update({
                            calendarId: 'primary',
                            eventId: appointment.googleEventId,
                            resource: eventDetails,
                            sendUpdates: 'all'
                        });
                    }
                    
                    appointment.title = title;
                    appointment.whoWith = whoWith;
                    appointment.dateTime = dateTime;
                    appointment.location = location;
                    appointment.recipientType = recipientType || appointment.recipientType;
                    appointment.recipientUserId = recipientUserId;
                    if (googleEventId) {
                        appointment.googleEventId = googleEventId;
                    }

                    const updatedAppointment = await appointment.save();
                    return res.json(updatedAppointment);
                } catch (refreshError) {
                    return res.status(401).json({
                        message: 'Failed to refresh Google access token',
                        details: 'Please reconnect your Google account'
                    });
                }
            } else {
                throw apiError;
            }
        }
    } catch (err) {
        res.status(400).json({ message: 'Error updating appointment' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized: Not your appointment' });
        }

        const appointmentDetails = {
            recipientType: appointment.recipientType,
            recipientUserId: appointment.recipientUserId,
            dateTime: appointment.dateTime,
            title: appointment.title,
            location: appointment.location,
            googleEventId: appointment.googleEventId
        };

        const user = await User.findById(userId);
        if (!user || !user.googleAccessToken) {
            return res.status(403).json({ message: 'Google Calendar access not available' });
        }

        const oauth2Client = new google.auth.OAuth2(
            "458898494944-2unrnoldtgo1augmdgs3q9030tgelarf.apps.googleusercontent.com",
            "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",
            process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback'
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        try {
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            
            if (appointment.googleEventId) {
                await calendar.events.delete({
                    calendarId: 'primary',
                    eventId: appointment.googleEventId,
                    sendUpdates: 'all'
                });
            }

            await appointment.deleteOne();

            if (appointmentDetails.recipientType === 'worklyft' && appointmentDetails.recipientUserId) {
                try {
                    const recipientAppointment = await Appointment.findOne({
                        userId: appointmentDetails.recipientUserId,
                        recipientUserId: userId,
                        dateTime: appointmentDetails.dateTime,
                        title: appointmentDetails.title,
                        location: appointmentDetails.location
                    });

                    if (recipientAppointment) {
                        await recipientAppointment.deleteOne();
                    }
                } catch (recipientError) {
                }
            }
            
            res.json({ 
                message: 'Appointment deleted successfully',
                deletedFromGoogle: !!appointmentDetails.googleEventId
            });

        } catch (apiError) {
            if (apiError.code === 401 || apiError.code === 403 || 
                (apiError.response && (apiError.response.status === 401 || apiError.response.status === 403))) {
                
                if (!user.googleRefreshToken) {
                    return res.status(401).json({
                        message: 'Google access token expired and no refresh token available',
                        details: 'Please reconnect your Google account'
                    });
                }
                
                try {
                    const newAccessToken = await refreshGoogleToken(user);
                    
                    oauth2Client.setCredentials({
                        access_token: newAccessToken,
                        refresh_token: user.googleRefreshToken
                    });
                    
                    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                    if (appointment.googleEventId) {
                        await calendar.events.delete({
                            calendarId: 'primary',
                            eventId: appointment.googleEventId,
                            sendUpdates: 'all'
                        });
                    }
                    
                    await appointment.deleteOne();

                    if (appointmentDetails.recipientType === 'worklyft' && appointmentDetails.recipientUserId) {
                        try {
                            const recipientAppointment = await Appointment.findOne({
                                userId: appointmentDetails.recipientUserId,
                                recipientUserId: userId,
                                dateTime: appointmentDetails.dateTime,
                                title: appointmentDetails.title,
                                location: appointmentDetails.location
                            });

                            if (recipientAppointment) {
                                await recipientAppointment.deleteOne();
                            }
                        } catch (recipientError) {
                        }
                    }
                    
                    return res.json({ 
                        message: 'Appointment deleted successfully after token refresh',
                        deletedFromGoogle: !!appointmentDetails.googleEventId
                    });
                } catch (refreshError) {
                    return res.status(401).json({
                        message: 'Failed to refresh Google access token',
                        details: 'Please reconnect your Google account'
                    });
                }
            } else {
                throw apiError;
            }
        }
    } catch (err) {
        res.status(500).json({ message: 'Error deleting appointment' });
    }
});

router.use((err, req, res, next) => {
    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({ message: 'Invalid ID format' });
    }
    res.status(500).json({ message: 'Internal server error' });
});

module.exports = router;