const router = require("express").Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");
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

router.use((req, res, next) => {
  console.log(`=== WEBHOOK ${req.method} ${req.path} ===`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});

router.get("/test", (req, res) => {
  console.log("✅ Webhook test endpoint called - NO AUTH REQUIRED");
  res.status(200).json({ 
    success: true, 
    message: "Webhook endpoint is accessible - no auth required",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

router.post("/", async (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: "Webhook received", 
    timestamp: new Date().toISOString()
  });

  setImmediate(async () => {
    try {
      console.log("=== 100MS WEBHOOK RECEIVED ===");
      console.log("Time:", new Date().toISOString());
      console.log("Body:", JSON.stringify(req.body, null, 2));
      
      const { type: event, data } = req.body;
      
      if (!event || !data) {
        console.log("❌ Invalid webhook payload - missing type or data");
        return;
      }
      
      console.log(`📡 Processing event: ${event} for room: ${data.room_id}`);
      
      const token = generateManagementToken();
      
      if (event === "beam.started.success") {
        const { beam_id, room_id } = data;
        console.log(`🎬 Recording started: ${beam_id} for room: ${room_id}`);
        
        let meeting = await Meeting.findOne({ roomId: room_id }).sort({ createdAt: -1 });
        
        if (!meeting) {
          console.log(`⚠️ No meeting found for room: ${room_id}, searching for most recent meeting with transcription enabled...`);
          meeting = await Meeting.findOne({ 
            'transcription.enabled': true 
          }).sort({ createdAt: -1 });
          
          if (meeting) {
            console.log(`🔧 Using most recent meeting with transcription enabled: ${meeting.name}`);
            meeting.roomId = room_id;
          }
        }
        
        if (meeting) {
          if (meeting.recordingStatus === "not_started") {
            meeting.recordingStatus = "started";
            meeting.recordingId = beam_id;
            await meeting.save();
            console.log(`✅ Recording status updated to started for meeting: ${meeting.name}`);
            console.log(`📹 Recording ID set to: ${beam_id}`);
          } else {
            console.log(`📹 Recording already in progress (${meeting.recordingStatus}) for meeting: ${meeting.name}`);
          }
        } else {
          console.log(`❌ No suitable meeting found for room: ${room_id}`);
        }
      }
      
      if (event === "beam.stopped.success") {
        const { beam_id, room_id } = data;
        console.log(`⏹️ Recording stopped: ${beam_id} for room: ${room_id}`);
        
        let meeting = await Meeting.findOne({ 
          $or: [
            { recordingId: beam_id },
            { roomId: room_id }
          ]
        }).sort({ createdAt: -1 });
        
        if (meeting) {
          meeting.recordingStatus = "stopped";
          meeting.transcription.status = "processing";
          await meeting.save();
          console.log(`✅ Recording stopped for meeting: ${meeting.name}, transcription processing`);
        } else {
          console.log(`❌ No meeting found for recording: ${beam_id} or room: ${room_id}`);
        }
      }
      
      if (event === "beam.recording.success") {
        const { recording_id, beam_id, room_id } = data;
        console.log(`📹 Recording completed: ${recording_id} from beam: ${beam_id} for room: ${room_id}`);
        
        let meeting = await Meeting.findOne({ 
          $or: [
            { recordingId: beam_id },
            { roomId: room_id }
          ]
        }).sort({ createdAt: -1 });
        
        if (meeting) {
          const oldRecordingId = meeting.recordingId;
          meeting.recordingId = recording_id;
          meeting.recordingStatus = "completed";
          await meeting.save();
          console.log(`✅ Recording completed for meeting: ${meeting.name}`);
          console.log(`🔄 Updated recording ID from ${oldRecordingId} to ${recording_id}`);
        } else {
          console.log(`❌ No meeting found for beam: ${beam_id} or room: ${room_id}`);
        }
      }
      
      if (event === "transcription.started.success") {
        const { recording_id, transcription_id, room_id } = data;
        console.log(`🎯 Transcription started for recording: ${recording_id} in room: ${room_id}`);
        
        let meeting = await Meeting.findOne({ 
          $or: [
            { recordingId: recording_id },
            { roomId: room_id }
          ]
        }).sort({ createdAt: -1 });
        
        if (!meeting) {
          console.log(`⚠️ No meeting found for recording: ${recording_id} or room: ${room_id}, searching for most recent meeting with transcription enabled...`);
          meeting = await Meeting.findOne({ 
            'transcription.enabled': true 
          }).sort({ createdAt: -1 });
          
          if (meeting) {
            console.log(`🔧 Using most recent meeting with transcription enabled: ${meeting.name}`);
            meeting.roomId = room_id;
            meeting.recordingId = recording_id;
          }
        }
        
        if (meeting) {
          meeting.transcription.status = "processing";
          meeting.transcription.transcriptionId = transcription_id;
          await meeting.save();
          console.log(`✅ Transcription started for meeting: ${meeting.name}`);
          console.log(`🎙️ Transcription ID set to: ${transcription_id}`);
        } else {
          console.log(`❌ No suitable meeting found for transcription start`);
        }
      }

      if (event === "transcription.success") {
        const { recording_id, room_id, duration } = data;
        console.log(`🎯 Processing transcription.success for recording: ${recording_id} in room: ${room_id}`);
        console.log(`⏰ Meeting duration: ${duration} seconds (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`);
        
        let meeting = null;
        
        if (recording_id) {
          console.log(`🔍 Searching by recording ID: ${recording_id}`);
          meeting = await Meeting.findOne({ recordingId: recording_id }).sort({ createdAt: -1 });
          
          if (meeting) {
            console.log(`✅ Found meeting by recording ID: ${meeting.name} (${meeting._id})`);
          }
        }
        
        if (!meeting) {
          console.log(`🔍 Searching for most recent meeting with transcription enabled...`);
          
          meeting = await Meeting.findOne({ 
            'transcription.enabled': true 
          }).sort({ createdAt: -1 });
          
          if (meeting) {
            console.log(`✅ Found most recent transcription-enabled meeting: ${meeting.name} (${meeting._id})`);
            
            meeting.roomId = room_id;
            meeting.recordingId = recording_id;
            
            console.log(`🔄 Updated meeting with room ID: ${room_id} and recording ID: ${recording_id}`);
          }
        }
        
        if (!meeting && room_id) {
          console.log(`🔍 Fallback: searching by room ID: ${room_id}`);
          meeting = await Meeting.findOne({ roomId: room_id }).sort({ createdAt: -1 });
          
          if (meeting) {
            console.log(`✅ Found meeting by room ID: ${meeting.name} (${meeting._id})`);
            
            if (meeting.recordingId !== recording_id) {
              console.log(`🔄 Updating recording ID from ${meeting.recordingId} to ${recording_id}`);
              meeting.recordingId = recording_id;
            }
          }
        }
        
        if (meeting) {
          console.log(`✅ FINAL SELECTED MEETING: ${meeting._id} (${meeting.name}) created at: ${meeting.createdAt}`);
          
          if (duration) {
            meeting.actualDuration = duration;
            console.log(`⏰ Updated meeting duration: ${duration} seconds`);
          }
          
          try {
            console.log("📝 Processing transcription with direct URLs...");
            
            if (data.transcript_txt_presigned_url) {
              console.log("📜 Fetching transcript from presigned URL");
              console.log("🔗 URL:", data.transcript_txt_presigned_url.substring(0, 100) + "...");
              
              const transcriptContent = await axios.get(data.transcript_txt_presigned_url, {
                timeout: 30000
              });
              
              meeting.transcription.transcript = transcriptContent.data;
              meeting.transcription.assets.txt = data.transcript_txt_presigned_url;
              console.log("✅ Transcript saved successfully");
              console.log("📄 Transcript preview:", transcriptContent.data.substring(0, 200) + "...");
            }
            
            if (data.summary_json_presigned_url) {
              console.log("📊 Fetching summary from presigned URL");
              console.log("🔗 URL:", data.summary_json_presigned_url.substring(0, 100) + "...");
              
              const summaryContent = await axios.get(data.summary_json_presigned_url, {
                timeout: 30000
              });
              
              const summaryData = typeof summaryContent.data === 'string' 
                ? JSON.parse(summaryContent.data) 
                : summaryContent.data;
                
              console.log("📋 Summary data keys:", Object.keys(summaryData || {}));
              console.log("📋 Summary data preview:", JSON.stringify(summaryData, null, 2).substring(0, 500) + "...");
              
              let agenda = [];
              let keyPoints = [];
              let actionItems = [];
              let shortSummary = "";
              let speakers = [];
              
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
                  } else if (title.includes('speaker')) {
                    speakers = section.bullets || [];
                    console.log(`👥 Found speakers: ${speakers.join(', ')}`);
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
                
                if (!shortSummary && speakers.length > 0) {
                  const speakerList = speakers.join(', ');
                  const durationText = duration ? ` for ${Math.floor(duration / 60)} minutes and ${duration % 60} seconds` : '';
                  shortSummary = `Meeting with participants: ${speakerList}${durationText}.`;
                  console.log(`📄 Generated fallback summary from speakers: ${shortSummary}`);
                }
              } else {
                agenda = summaryData.agenda || summaryData.Agenda || [];
                keyPoints = summaryData.key_points || summaryData["Key Points"] || [];
                actionItems = summaryData.action_items || summaryData["Action Items"] || [];
                shortSummary = summaryData.short_summary || summaryData["Short Summary"] || "";
                speakers = summaryData.speakers || summaryData.Speakers || [];
              }
              
              meeting.transcription.summary = {
                agenda,
                keyPoints,
                actionItems,
                shortSummary,
                speakers
              };
              
              meeting.transcription.rawSummary = summaryData;
              
              console.log("✅ Summary saved successfully");
              
              console.log("💾 Saved summary structure:");
              console.log("  - Agenda items:", meeting.transcription.summary.agenda.length);
              console.log("  - Key points:", meeting.transcription.summary.keyPoints.length);
              console.log("  - Action items:", meeting.transcription.summary.actionItems.length);
              console.log("  - Speakers:", meeting.transcription.summary.speakers.length);
              console.log("  - Short summary length:", meeting.transcription.summary.shortSummary.length);
              console.log("  - Short summary preview:", meeting.transcription.summary.shortSummary.substring(0, 100) + "...");
            }
            
            if (data.transcript_srt_presigned_url) {
              meeting.transcription.assets.srt = data.transcript_srt_presigned_url;
            }
            if (data.transcript_json_presigned_url) {
              meeting.transcription.assets.json = data.transcript_json_presigned_url;
            }
            
            meeting.transcription.status = "completed";
            meeting.recordingStatus = "completed";
            
            console.log("🎉 Transcription status set to completed");
            console.log(`📋 Updated meeting: ${meeting.name} (${meeting._id})`);
            console.log(`📋 Final status - Recording: ${meeting.recordingStatus}, Transcription: ${meeting.transcription.status}`);
          } catch (error) {
            console.error("❌ Error fetching transcription data:", error.message);
            meeting.transcription.status = "failed";
          }
          
          await meeting.save();
          console.log(`💾 Meeting saved with transcription data for: ${meeting.name}`);
          console.log(`🔍 Final meeting state: Recording: ${meeting.recordingStatus}, Transcription: ${meeting.transcription.status}`);
          
          try {
            const savedMeeting = await Meeting.findById(meeting._id);
            console.log(`✅ Verification - Summary in DB for "${savedMeeting.name}":`, {
              meetingId: savedMeeting._id,
              agenda: savedMeeting.transcription?.summary?.agenda?.length || 0,
              keyPoints: savedMeeting.transcription?.summary?.keyPoints?.length || 0,
              actionItems: savedMeeting.transcription?.summary?.actionItems?.length || 0,
              shortSummary: savedMeeting.transcription?.summary?.shortSummary?.length || 0,
              shortSummaryPreview: savedMeeting.transcription?.summary?.shortSummary?.substring(0, 50) || "(empty)",
              transcriptionStatus: savedMeeting.transcription?.status,
              recordingStatus: savedMeeting.recordingStatus
            });
          } catch (verifyError) {
            console.error("❌ Error verifying save:", verifyError.message);
          }
        } else {
          console.log(`❌ No suitable meeting found for recording: ${recording_id} or room: ${room_id}`);
          
          const recentMeetings = await Meeting.find({}).sort({ createdAt: -1 }).limit(10);
          console.log("🔍 All recent meetings in database:");
          recentMeetings.forEach(m => {
            console.log(`  - ${m.name} (${m.createdAt}) - Room: ${m.roomId} - Recording: ${m.recordingId} - Trans: ${m.transcription?.enabled}`);
          });
        }
      }
      
      if (event === "transcription.failure") {
        const { recording_id, room_id, duration } = data;
        console.log(`❌ Transcription failed for recording: ${recording_id} in room: ${room_id}`);
        console.log(`⏰ Meeting duration: ${duration} seconds (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`);
        
        let meeting = null;
        
        if (recording_id) {
          console.log(`🔍 Searching by recording ID: ${recording_id}`);
          meeting = await Meeting.findOne({ recordingId: recording_id }).sort({ createdAt: -1 });
          
          if (meeting) {
            console.log(`✅ Found meeting by recording ID: ${meeting.name} (${meeting._id})`);
          }
        }
        
        if (!meeting) {
          console.log(`🔍 Searching for most recent meeting with transcription enabled...`);
          
          meeting = await Meeting.findOne({ 
            'transcription.enabled': true 
          }).sort({ createdAt: -1 });
          
          if (meeting) {
            console.log(`✅ Found most recent transcription-enabled meeting: ${meeting.name} (${meeting._id})`);
            
            meeting.roomId = room_id;
            meeting.recordingId = recording_id;
            
            console.log(`🔄 Updated meeting with room ID: ${room_id} and recording ID: ${recording_id}`);
          }
        }
        
        if (!meeting && room_id) {
          console.log(`🔍 Fallback: searching by room ID: ${room_id}`);
          meeting = await Meeting.findOne({ roomId: room_id }).sort({ createdAt: -1 });
          
          if (meeting) {
            console.log(`✅ Found meeting by room ID: ${meeting.name} (${meeting._id})`);
            
            if (meeting.recordingId !== recording_id) {
              console.log(`🔄 Updating recording ID from ${meeting.recordingId} to ${recording_id}`);
              meeting.recordingId = recording_id;
            }
          }
        }
        
        if (meeting) {
          console.log(`✅ FINAL SELECTED MEETING: ${meeting._id} (${meeting.name}) created at: ${meeting.createdAt}`);
          
          if (duration) {
            meeting.actualDuration = duration;
            console.log(`⏰ Updated meeting duration: ${duration} seconds`);
          }
          
          meeting.transcription.status = "failed";
          meeting.recordingStatus = "completed";
          
          if (data.transcript_txt_presigned_url) {
            try {
              console.log("📜 Attempting to fetch transcript despite transcription failure");
              console.log("🔗 URL:", data.transcript_txt_presigned_url.substring(0, 100) + "...");
              
              const transcriptContent = await axios.get(data.transcript_txt_presigned_url, {
                timeout: 30000
              });
              
              meeting.transcription.transcript = transcriptContent.data;
              meeting.transcription.assets.txt = data.transcript_txt_presigned_url;
              console.log("✅ Transcript retrieved successfully despite failure");
              console.log("📄 Transcript preview:", transcriptContent.data.substring(0, 200) + "...");
              
              if (transcriptContent.data && transcriptContent.data.trim().length > 0) {
                meeting.transcription.status = "completed";
                console.log("📝 Transcription status updated to completed (transcript available, no summary)");
              }
            } catch (transcriptError) {
              console.error("❌ Failed to fetch transcript from failed transcription:", transcriptError.message);
            }
          }
          
          if (data.transcript_srt_presigned_url) {
            meeting.transcription.assets.srt = data.transcript_srt_presigned_url;
          }
          if (data.transcript_json_presigned_url) {
            meeting.transcription.assets.json = data.transcript_json_presigned_url;
          }
          
          meeting.transcription.summary = {
            agenda: [],
            keyPoints: [],
            actionItems: [],
            shortSummary: "",
            speakers: []
          };
          
          meeting.transcription.rawSummary = {
            error: "Transcription processing failed",
            originalData: data,
            failureType: "transcription.failure"
          };
          
          await meeting.save();
          console.log(`💾 Meeting updated with transcription failure status: ${meeting.name}`);
          console.log(`🔍 Final meeting state: Recording: ${meeting.recordingStatus}, Transcription: ${meeting.transcription.status}`);
          
          try {
            const savedMeeting = await Meeting.findById(meeting._id);
            console.log(`✅ Verification - Failure handled for "${savedMeeting.name}":`, {
              meetingId: savedMeeting._id,
              transcriptionStatus: savedMeeting.transcription?.status,
              recordingStatus: savedMeeting.recordingStatus,
              hasTranscript: savedMeeting.transcription?.transcript ? "Yes" : "No",
              transcriptLength: savedMeeting.transcription?.transcript?.length || 0
            });
          } catch (verifyError) {
            console.error("❌ Error verifying failure save:", verifyError.message);
          }
        } else {
          console.log(`❌ No suitable meeting found for failed transcription: ${recording_id} or room: ${room_id}`);
        }
      }
      
      if (event === "transcription.failed") {
        const { recording_id, room_id } = data;
        console.log(`❌ Transcription failed (legacy event) for recording: ${recording_id} in room: ${room_id}`);
        
        let meeting = await Meeting.findOne({ 
          $or: [
            { recordingId: recording_id },
            { roomId: room_id }
          ]
        }).sort({ createdAt: -1 });
        
        if (meeting) {
          meeting.transcription.status = "failed";
          meeting.transcription.summary = {
            agenda: [],
            keyPoints: [],
            actionItems: [],
            shortSummary: "",
            speakers: []
          };
          await meeting.save();
          console.log(`❌ Transcription marked as failed for meeting: ${meeting.name}`);
        }
      }
      
      console.log("🎉 Webhook processed successfully");
    } catch (err) {
      console.error("❌ Webhook error:", err.message);
      console.error("Full error:", err);
    }
  });
});

module.exports = router;
