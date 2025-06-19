const express = require('express');
const { google } = require('googleapis');
const User = require('../../models/Auth/User');
const router = express.Router();


const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback';

const getUserId = (req) => {
    if (req.user && req.user.id) {
        return req.user.id;
    } else if (req.cookies && req.cookies.userId) {
        return req.cookies.userId;
    } else {
        return null;
    }
};

async function createCalendarEvent(oauth2Client, eventDetails) {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    return await calendar.events.insert({
        calendarId: 'primary',
        resource: eventDetails,
        sendNotifications: true,
        sendUpdates: 'all'
    });
}

async function refreshGoogleToken(user) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            "458898494944-2unrnoldtgo1augmdgs3q9030tgelarf.apps.googleusercontent.com",
            "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",
            REDIRECT_URI
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

router.get('/events', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const startDate = req.query.start ? new Date(req.query.start) : new Date();
        const endDate = req.query.end ? new Date(req.query.end) : new Date();
        
        if (!req.query.start) {
            startDate.setDate(startDate.getDate() - startDate.getDay());
        }
        
        if (!req.query.end) {
            endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (!user.googleAccessToken) {
            return res.status(403).json({ 
                message: 'Google Calendar access not available', 
                details: 'No Google access token found. Please reconnect your Google account.'
            });
        }

        const oauth2Client = new google.auth.OAuth2(
            "458898494944-2unrnoldtgo1augmdgs3q9030tgelarf.apps.googleusercontent.com",
            "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",
            REDIRECT_URI
        );
        
        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        try {
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            await calendar.calendarList.get({ calendarId: 'primary' });
            
            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: startDate.toISOString(),
                timeMax: endDate.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            
            res.json(response.data.items || []);
        } catch (apiError) {
            if (apiError.code === 401 || apiError.code === 403 || 
                (apiError.response && (apiError.response.status === 401 || apiError.response.status === 403))) {
                
                if (!user.googleRefreshToken) {
                    return res.status(401).json({
                        message: 'Google Calendar access token expired and no refresh token available',
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
                    const response = await calendar.events.list({
                        calendarId: 'primary',
                        timeMin: startDate.toISOString(),
                        timeMax: endDate.toISOString(),
                        singleEvents: true,
                        orderBy: 'startTime',
                    });
                    
                    return res.json(response.data.items || []);
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
    } catch (error) {
        let errorMessage = 'Error fetching calendar events';
        let errorDetails = {};
        let statusCode = 500;
        
        if (error.response) {
            errorDetails = {
                status: error.response.status,
                data: error.response.data
            };
            
            if (error.response.status === 403) {
                errorMessage = 'Google Calendar API access forbidden';
                statusCode = 403;
                
                const errorReason = error.response.data?.error?.errors?.[0]?.reason;
                if (errorReason === 'accessNotConfigured' || errorReason === 'notFound') {
                    errorMessage = 'Google Calendar API is not enabled for this project';
                    errorDetails.solution = 'Enable the Google Calendar API in the Google Cloud Console';
                }
            } else if (error.response.status === 404) {
                errorMessage = 'Calendar not found';
                statusCode = 404;
            }
        } else {
            errorDetails = { message: error.message };
        }
        
        res.status(statusCode).json({ 
            message: errorMessage,
            details: errorDetails
        });
    }
});

router.post('/create-event', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                message: 'Unauthorized: No user ID found' 
            });
        }
        
        const { title, whoWith, dateTime, location, description, duration = 60 } = req.body;
        
        // Validate required fields
        if (!title || !whoWith || !dateTime || !location) {
            return res.status(400).json({ 
                success: false,
                message: 'Missing required fields: title, whoWith, dateTime, and location are required' 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(whoWith)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid email format for attendee' 
            });
        }
        
        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }
        
        if (!user.googleAccessToken) {
            return res.status(403).json({ 
                success: false,
                message: 'Google Calendar access not available',
                details: 'Please connect your Google account with proper Calendar permissions'
            });
        }
        
        // Set up OAuth client
        const oauth2Client = new google.auth.OAuth2(
            "458898494944-2unrnoldtgo1augmdgs3q9030tgelarf.apps.googleusercontent.com",
            "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",
            REDIRECT_URI
        );
        
        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });
        
        // Parse dates
        const startDateTime = new Date(dateTime);
        const endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(startDateTime.getMinutes() + parseInt(duration));
        
        // Get user's timezone
        let userTimeZone = 'UTC';
        try {
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            const settingsResponse = await calendar.settings.get({
                setting: 'timezone'
            });
            userTimeZone = settingsResponse.data.value || 'UTC';
        } catch (err) {
            // Default to UTC if we can't get the timezone
        }
        
        // Prepare event details
        const eventDetails = {
            summary: title,
            location: location,
            description: description || `Appointment with ${whoWith}`,
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
            },
            guestsCanSeeOtherGuests: true,
            guestsCanModify: false,
            sendUpdates: 'all'
        };
        
        try {
            // Try to create the event
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: eventDetails,
                sendNotifications: true
            });
            
            return res.json({
                success: true,
                message: 'Event created successfully and invitation sent',
                eventId: response.data.id,
                eventLink: response.data.htmlLink,
                event: {
                    id: response.data.id,
                    summary: response.data.summary,
                    start: response.data.start,
                    end: response.data.end,
                    attendees: response.data.attendees,
                    htmlLink: response.data.htmlLink
                }
            });
            
        } catch (apiError) {
            // Handle token expiration
            if (apiError.code === 401 || apiError.code === 403 || 
                (apiError.response && (apiError.response.status === 401 || apiError.response.status === 403))) {
                
                if (!user.googleRefreshToken) {
                    return res.status(401).json({
                        success: false,
                        message: 'Google access token expired and no refresh token available',
                        details: 'Please reconnect your Google account'
                    });
                }
                
                try {
                    const newAccessToken = await refreshGoogleToken(user);
                    
                    // Update OAuth client with new token
                    oauth2Client.setCredentials({
                        access_token: newAccessToken,
                        refresh_token: user.googleRefreshToken
                    });
                    
                    // Retry event creation
                    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                    const retryResponse = await calendar.events.insert({
                        calendarId: 'primary',
                        resource: eventDetails,
                        sendNotifications: true
                    });
                    
                    return res.json({
                        success: true,
                        message: 'Event created successfully after token refresh',
                        eventId: retryResponse.data.id,
                        eventLink: retryResponse.data.htmlLink,
                        event: {
                            id: retryResponse.data.id,
                            summary: retryResponse.data.summary,
                            start: retryResponse.data.start,
                            end: retryResponse.data.end,
                            attendees: retryResponse.data.attendees,
                            htmlLink: retryResponse.data.htmlLink
                        }
                    });
                    
                } catch (refreshError) {
                    return res.status(401).json({
                        success: false,
                        message: 'Failed to refresh Google access token',
                        details: 'Please reconnect your Google account with Calendar permissions'
                    });
                }
            } else {
                // Other API errors
                const errorMessage = apiError.response?.data?.error?.message || apiError.message || 'Unknown error';
                
                return res.status(apiError.response?.status || 500).json({
                    success: false,
                    message: 'Google Calendar API error',
                    details: errorMessage,
                    errorCode: apiError.code
                });
            }
        }
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error while creating calendar event',
            details: error.message
        });
    }
});

router.post('/check-conflicts', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const { startTime, endTime } = req.body;
        
        if (!startTime || !endTime) {
            return res.status(400).json({ message: 'Start and end times are required' });
        }

        const user = await User.findById(userId);
        if (!user || !user.googleAccessToken) {
            return res.status(403).json({ message: 'Google Calendar access not available' });
        }

        const oauth2Client = new google.auth.OAuth2(
            "458898494944-2unrnoldtgo1augmdgs3q9030tgelarf.apps.googleusercontent.com",
            "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",
            REDIRECT_URI
        );
        
        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date(startTime).toISOString(),
            timeMax: new Date(endTime).toISOString(),
            singleEvents: true,
        });

        const hasConflicts = (response.data.items || []).length > 0;
        
        res.json({ 
            hasConflicts,
            conflicts: response.data.items || []
        });
    } catch (error) {
        let errorMessage = 'Error checking for conflicts';
        
        if (error.response && error.response.status) {
            errorMessage = `Server responded with status ${error.response.status}`;
        }
        
        res.status(500).json({ 
            message: errorMessage,
            details: error.message
        });
    }
});

router.put('/update-event/:eventId', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                message: 'Unauthorized: No user ID found' 
            });
        }
        
        const { eventId } = req.params;
        const { title, whoWith, dateTime, location, description, duration = 60 } = req.body;
        

        if (!title || !whoWith || !dateTime || !location) {
            return res.status(400).json({ 
                success: false,
                message: 'Missing required fields: title, whoWith, dateTime, and location are required' 
            });
        }
        

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(whoWith)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid email format for attendee' 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }
        
        if (!user.googleAccessToken) {
            return res.status(403).json({ 
                success: false,
                message: 'Google Calendar access not available',
                details: 'Please connect your Google account with proper Calendar permissions'
            });
        }
        
        // Set up OAuth client
        const oauth2Client = new google.auth.OAuth2(
            "458898494944-2unrnoldtgo1augmdgs3q9030tgelarf.apps.googleusercontent.com",
            "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",
            REDIRECT_URI
        );
        
        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });
        

        const startDateTime = new Date(dateTime);
        const endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(startDateTime.getMinutes() + parseInt(duration));
        

        let userTimeZone = 'UTC';
        try {
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            const settingsResponse = await calendar.settings.get({
                setting: 'timezone'
            });
            userTimeZone = settingsResponse.data.value || 'UTC';
        } catch (err) {
            // Default to UTC if we can't get the timezone
        }
        
        // Prepare event details
        const eventDetails = {
            summary: title,
            location: location,
            description: description || `Appointment with ${whoWith}`,
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
            },
            guestsCanSeeOtherGuests: true,
            guestsCanModify: false,
            sendUpdates: 'all'
        };
        
        try {
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            const response = await calendar.events.update({
                calendarId: 'primary',
                eventId: eventId,
                resource: eventDetails,
                sendNotifications: true
            });
            
            return res.json({
                success: true,
                message: 'Event updated successfully and notifications sent',
                eventId: response.data.id,
                eventLink: response.data.htmlLink,
                event: {
                    id: response.data.id,
                    summary: response.data.summary,
                    start: response.data.start,
                    end: response.data.end,
                    attendees: response.data.attendees,
                    htmlLink: response.data.htmlLink
                }
            });
            
        } catch (apiError) {
            // Handle token expiration
            if (apiError.code === 401 || apiError.code === 403 || 
                (apiError.response && (apiError.response.status === 401 || apiError.response.status === 403))) {
                
                if (!user.googleRefreshToken) {
                    return res.status(401).json({
                        success: false,
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
                    const retryResponse = await calendar.events.update({
                        calendarId: 'primary',
                        eventId: eventId,
                        resource: eventDetails,
                        sendNotifications: true
                    });
                    
                    return res.json({
                        success: true,
                        message: 'Event updated successfully after token refresh',
                        eventId: retryResponse.data.id,
                        eventLink: retryResponse.data.htmlLink,
                        event: {
                            id: retryResponse.data.id,
                            summary: retryResponse.data.summary,
                            start: retryResponse.data.start,
                            end: retryResponse.data.end,
                            attendees: retryResponse.data.attendees,
                            htmlLink: retryResponse.data.htmlLink
                        }
                    });
                    
                } catch (refreshError) {
                    return res.status(401).json({
                        success: false,
                        message: 'Failed to refresh Google access token',
                        details: 'Please reconnect your Google account with Calendar permissions'
                    });
                }
            } else {
                const errorMessage = apiError.response?.data?.error?.message || apiError.message || 'Unknown error';
                
                return res.status(apiError.response?.status || 500).json({
                    success: false,
                    message: 'Google Calendar API error',
                    details: errorMessage,
                    errorCode: apiError.code
                });
            }
        }
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error while updating calendar event',
            details: error.message
        });
    }
});

module.exports = router;
