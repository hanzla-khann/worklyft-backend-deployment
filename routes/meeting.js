const router = require("express").Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const Server = require("../models/Servers/server");
const Meeting = require("../models/Meeting");

function generateManagementToken() {
  const payload = {
    access_key: process.env.APP_ACCESS_KEY_HMS,
    type: "management",
    version: 2,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    jti: Math.random().toString(36).substring(2),
  };

  return jwt.sign(payload, process.env.APP_SECRET_KEY_HMS, {
    algorithm: "HS256",
  });
}

router.post("/create-room", async (req, res) => {
  const { name, description, type, server, enableRecording } = req.body;
  const token = generateManagementToken();

  if (!name || !description) {
    return res
      .status(400)
      .json({ message: "Room name and description are required." });
  }
  
  console.log("🎯 Creating room with request:", { 
    name, 
    description, 
    type, 
    server: server?.name, 
    enableRecording 
  });
  
  try {
    const uniqueRoomName = `${name}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    const roomRes = await axios.post(
      "https://api.100ms.live/v2/rooms",
      {
        name: uniqueRoomName,
        description: `${description} (Created at ${new Date().toISOString()})`,
        template_id: process.env.TEMPLATE_ID_HMS,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const roomId = roomRes.data.id;

    const codeRes = await axios.post(
      "https://api.100ms.live/v2/room-codes/room/" + roomId,
      {
        role: "host",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const hostRoomCode = codeRes.data.data.find(
      (obj) => obj.role === "host"
    )?.code;
    const guestRoomCode = codeRes.data.data.find(
      (obj) => obj.role === "guest"
    )?.code;

    console.log(req.user);

    const meeting = new Meeting({
      host: req.user.id,
      name,
      description,
      type,
      server: server._id,
      hostRoomCode,
      guestRoomCode,
      status: "active",
      roomId: roomId,
      recordingStatus: "not_started",
      transcription: {
        enabled: Boolean(enableRecording),
        status: "not_started"
      }
    });

    const savedMeeting = await meeting.save();
    console.log(`💾 Saved meeting to database: ${savedMeeting._id} with room ID: ${roomId}`);
    console.log(`🎙️ Transcription enabled: ${savedMeeting.transcription.enabled}`);
    console.log(`📹 Recording status: ${savedMeeting.recordingStatus}`);
    console.log(`🆕 Unique room name: ${uniqueRoomName}`);
    console.log(`🏷️ Meeting "${name}" assigned to room ${roomId} at ${savedMeeting.createdAt}`);

    res.json({
      message: "Room created successfully",
      success: true,
      hostRoomCode,
      guestRoomCode,
      roomId: roomId,
      meetingId: savedMeeting._id,
    });
  } catch (err) {
    console.error("❌ Room creation error:", err.response?.data || err.message);
    res.status(500).json({ message: "Room creation failed" });
  }
});

router.get("/ongoing-meetings", async (req, res) => {
  try {
    const servers = await Server.find({
      "members.user": req.user.id,
    });
    const meetings = await Meeting.find({
      status: "active",
      type: "public",
      server: { $in: servers.map((s) => s._id) },
    })
      .populate("server")
      .populate("host");
    res.json({ success: true, data: meetings });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res
      .status(500)
      .json({ message: "An Error occurred while fetching ongoing meetings" });
  }
});

router.get("/meeting-data", async (req, res) => {
  try {
    const userId = req.user.id;
    const meeting = await Meeting.findOne({
      host: userId,
      status: "active",
    })
      .populate("host")
      .populate("server");

    res.json({ success: true, data: meeting });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res
      .status(500)
      .json({ message: "An Error occurred while fetching meeting data" });
  }
});

router.get("/meeting-by-code/:roomCode", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const meeting = await Meeting.findOne({
      $or: [
        { hostRoomCode: roomCode },
        { guestRoomCode: roomCode }
      ],
      status: "active",
    })
      .populate("host")
      .populate("server");

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    res.json({ success: true, data: meeting });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res
      .status(500)
      .json({ message: "An Error occurred while fetching meeting data" });
  }
});

router.post("/start-recording/:meetingId", async (req, res) => {
  try {
    const { meetingId } = req.params;
    const token = generateManagementToken();

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (!meeting.roomId) {
      return res.status(400).json({ message: "Room ID not found for this meeting" });
    }

    console.log(`🎬 Starting recording for meeting: ${meeting.name} (${meetingId})`);
    console.log(`🏠 Room ID: ${meeting.roomId}`);
    console.log(`📅 Meeting created at: ${meeting.createdAt}`);

    const recordingRes = await axios.post(
      `https://api.100ms.live/v2/recordings/room/${meeting.roomId}/start`,
      {
        resolution: {
          width: 1280,
          height: 720
        },
        transcription: {
          enabled: true,
          output_modes: ["txt", "srt", "json"],
          custom_vocabulary: ["100ms", "WebSDK", "Flutter", "worklyft", "meeting"],
          summary: {
            enabled: true,
            context: `This is a ${meeting.type} meeting named "${meeting.name}" about ${meeting.description}. Meeting created at ${meeting.createdAt}.`,
            sections: [
              {
                title: "Agenda",
                format: "bullets"
              },
              {
                title: "Key Points", 
                format: "bullets"
              },
              {
                title: "Action Items",
                format: "bullets"
              },
              {
                title: "Short Summary",
                format: "paragraph"
              }
            ],
            temperature: 0.5
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      }
    );

    console.log(`✅ Recording started successfully. Recording ID: ${recordingRes.data.id}`);
    console.log(`📊 Recording status: ${recordingRes.data.status}`);

    meeting.recordingId = recordingRes.data.id;
    meeting.recordingStatus = "started";
    meeting.transcription.enabled = true;
    meeting.transcription.status = "not_started";
    await meeting.save();

    console.log(`💾 Meeting updated in database with recording ID: ${recordingRes.data.id}`);
    console.log(`📹 Recording status set to: started`);
    console.log(`🏷️ This should help webhook identify the correct meeting later`);

    res.json({
      success: true,
      message: "Recording started successfully",
      recordingId: recordingRes.data.id,
      status: "started"
    });
  } catch (err) {
    console.error("❌ Failed to start recording:", err.response?.data || err.message);
    res.status(500).json({ message: "Failed to start recording" });
  }
});

router.post("/stop-recording/:meetingId", async (req, res) => {
  try {
    const { meetingId } = req.params;
    const token = generateManagementToken();

    const meeting = await Meeting.findById(meetingId);
    if (!meeting || !meeting.recordingId) {
      return res.status(404).json({ message: "Recording not found" });
    }

    await axios.post(
      `https://api.100ms.live/v2/recordings/${meeting.recordingId}/stop`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    meeting.recordingStatus = "stopped";
    meeting.transcription.status = "processing";
    await meeting.save();

    res.json({
      success: true,
      message: "Recording stopped successfully"
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "Failed to stop recording" });
  }
});

router.get("/transcription/:meetingId", async (req, res) => {
  try {
    const { meetingId } = req.params;
    const token = generateManagementToken();

    const meeting = await Meeting.findById(meetingId);
    if (!meeting || !meeting.recordingId) {
      return res.status(404).json({ message: "Recording not found" });
    }

    const recordingRes = await axios.get(
      `https://api.100ms.live/v2/recordings/${meeting.recordingId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const recording = recordingRes.data;
    
    if (recording.recording_assets) {
      const assets = recording.recording_assets;
      
      const transcriptAsset = assets.find(asset => asset.type === "transcript");
      const summaryAsset = assets.find(asset => asset.type === "summary");
      
      if (transcriptAsset) {
        meeting.transcription.assets = {
          txt: transcriptAsset.url,
          srt: transcriptAsset.url,
          json: transcriptAsset.url
        };
        meeting.transcription.status = "completed";
      }
      
      if (summaryAsset) {
        try {
          const summaryData = JSON.parse(summaryAsset.data || "{}");
          meeting.transcription.summary = {
            agenda: summaryData.agenda || [],
            keyPoints: summaryData.key_points || [],
            actionItems: summaryData.action_items || [],
            shortSummary: summaryData.short_summary || ""
          };
        } catch (e) {
          console.error("Error parsing summary data:", e);
        }
      }
      
      await meeting.save();
    }

    res.json({
      success: true,
      data: {
        recording: recording,
        transcription: meeting.transcription
      }
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "Failed to get transcription" });
  }
});

router.get("/user-meetings", async (req, res) => {
  try {
    const userId = req.user.id;
    const meetings = await Meeting.find({
      $or: [
        { host: userId },
      ]
    })
      .populate("host", "username email")
      .populate("server", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, data: meetings });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "Failed to fetch user meetings" });
  }
});

router.post("/fetch-transcription/:meetingId", async (req, res) => {
  try {
    const { meetingId } = req.params;
    const token = generateManagementToken();

    const meeting = await Meeting.findById(meetingId);
    if (!meeting || !meeting.recordingId) {
      return res.status(404).json({ message: "Recording not found" });
    }

    console.log(`Manually fetching transcription for recording: ${meeting.recordingId}`);

    const recordingRes = await axios.get(
      `https://api.100ms.live/v2/recordings/${meeting.recordingId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const recording = recordingRes.data;
    console.log("Manual fetch - Recording data:", JSON.stringify(recording, null, 2));
    
    if (recording.recording_assets && recording.recording_assets.length > 0) {
      const assets = recording.recording_assets;
      
      const transcriptAsset = assets.find(asset => asset.type === "transcript");
      const summaryAsset = assets.find(asset => asset.type === "summary");
      
      if (transcriptAsset) {
        console.log("Manual fetch - Found transcript asset:", transcriptAsset.id);
        const transcriptRes = await axios.get(
          `https://api.100ms.live/v2/recording-assets/${transcriptAsset.id}/presigned-url`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        if (transcriptRes.data.url) {
          const transcriptContent = await axios.get(transcriptRes.data.url);
          meeting.transcription.transcript = transcriptContent.data;
          meeting.transcription.assets.txt = transcriptRes.data.url;
          console.log("Manual fetch - Transcript saved");
        }
        
        meeting.transcription.status = "completed";
      }
      
      if (summaryAsset) {
        console.log("Manual fetch - Found summary asset:", summaryAsset.id);
        const summaryRes = await axios.get(
          `https://api.100ms.live/v2/recording-assets/${summaryAsset.id}/presigned-url`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        if (summaryRes.data.url) {
          try {
            const summaryContent = await axios.get(summaryRes.data.url);
            const summaryData = typeof summaryContent.data === 'string' 
              ? JSON.parse(summaryContent.data) 
              : summaryContent.data;
              
            console.log("Manual fetch - Summary data:", summaryData);
            
            let agenda = [];
            let keyPoints = [];
            let actionItems = [];
            let shortSummary = "";
            
            if (summaryData.sections) {
              summaryData.sections.forEach(section => {
                const title = section.title.toLowerCase();
                
                if (title.includes('agenda')) {
                  agenda = section.bullets || [];
                } else if (title.includes('key') || title.includes('point')) {
                  keyPoints = section.bullets || [];
                } else if (title.includes('action')) {
                  actionItems = section.bullets || [];
                } else if (title.includes('summary')) {
                  shortSummary = section.paragraph || section.bullets?.join(' ') || "";
                }
                
                if (title === 'short summary' && section.paragraph) {
                  shortSummary = section.paragraph;
                }
              });
              
              if (!shortSummary && summaryData.sections.length > 0) {
                const summarySection = summaryData.sections.find(s => 
                  s.paragraph && s.paragraph.length > 20
                );
                if (summarySection) {
                  shortSummary = summarySection.paragraph;
                }
              }
            } else {
              agenda = summaryData.agenda || summaryData.Agenda || [];
              keyPoints = summaryData.key_points || summaryData["Key Points"] || [];
              actionItems = summaryData.action_items || summaryData["Action Items"] || [];
              shortSummary = summaryData.short_summary || summaryData["Short Summary"] || "";
            }
            
            meeting.transcription.summary = {
              agenda,
              keyPoints,
              actionItems,
              shortSummary
            };
            
            meeting.transcription.rawSummary = summaryData;
            
            console.log("Manual fetch - Summary saved with:", {
              agenda: agenda.length,
              keyPoints: keyPoints.length,
              actionItems: actionItems.length,
              shortSummary: shortSummary.length
            });
          } catch (e) {
            console.error("Error parsing summary data:", e);
          }
        }
      }
      
      await meeting.save();
      console.log("Manual fetch - Meeting saved");
    }

    res.json({
      success: true,
      data: {
        recording: recording,
        transcription: meeting.transcription
      }
    });
  } catch (err) {
    console.error("Manual fetch error:", err.response?.data || err.message);
    res.status(500).json({ message: "Failed to fetch transcription" });
  }
});

module.exports = router;