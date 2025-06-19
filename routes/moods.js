const router = require("express").Router();
const Mood = require("../models/Mood");

// Submit mood
router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { mood, value, note } = req.body;

    // Validate mood input
    if (!mood || !value) {
      return res.status(400).json({
        success: false,
        message: "Mood and value are required fields",
      });
    }

    // Create new mood entry
    const newMood = new Mood({
      userId,
      mood,
      value,
      note,
      date: new Date()
    });

    await newMood.save();

    res.status(201).json({
      success: true,
      message: "Mood recorded successfully",
      data: newMood,
    });
  } catch (error) {
    console.error("Error recording mood:", error);
    res.status(500).json({
      success: false,
      message: "Error recording mood",
      error: error.message,
    });
  }
});

// Get user's mood history (for the last 30 days by default)
router.get("/history", async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const moods = await Mood.find({
      userId,
      date: { $gte: startDate }
    }).sort({ date: 1 });
    
    res.status(200).json({
      success: true,
      data: moods,
    });
  } catch (error) {
    console.error("Error fetching mood history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching mood history",
      error: error.message,
    });
  }
});

// Get today's mood
router.get("/today", async (req, res) => {
  try {
    const userId = req.user.id;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const mood = await Mood.findOne({
      userId,
      date: { $gte: today, $lt: tomorrow }
    });
    
    if (!mood) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: "No mood recorded for today",
      });
    }
    
    res.status(200).json({
      success: true,
      exists: true,
      data: mood,
    });
  } catch (error) {
    console.error("Error fetching today's mood:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching today's mood",
      error: error.message,
    });
  }
});

module.exports = router;
