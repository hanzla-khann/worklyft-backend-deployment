const router = require("express").Router();
const Conversation = require("../../models/DM/Conversation");
const Message = require("../../models/DM/Message");

router.get("/", async (req, res) => {
  try {
    let conversation = await Conversation.findOne({
      members: { $all: [req.query.senderId, req.query.receiverId] },
    })
      .populate("lastMessage")
      .populate("members");
    if (!conversation) {
      return res.status(200).json({
        success: false,
        message: "Conversation does not exist between these members",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Conversation Fetched Successfully",
      conversation,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to Fetch Conversation" });
  }
});

// Create New Conversation
router.post("/", async (req, res) => {
  try {
    let existingConversation = await Conversation.findOne({
      members: { $all: [req.body.senderId, req.body.receiverId] },
    });

    if (existingConversation) {
      return res.status(400).json({
        success: false,
        message: "Conversation already exists between these members",
        data: existingConversation,
      });
    }
    let conversation = await Conversation.create({
      members: [req.body.senderId, req.body.receiverId],
    });

    conversation = await Conversation.findById(conversation._id).populate(
      "members"
    );

    res.status(200).json({
      success: true,
      message: "Conversation Created Successfully",
      data: conversation,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Fetch All Conversation of a User
router.get("/:userId", async (req, res) => {
  try {
    const conversation = await Conversation.find({
      members: { $in: [req.params.userId] },
    })
      .populate("members")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });
    res.status(200).json({
      success: true,
      message: "Conversation Fetched Successfully",
      data: conversation,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Fetch Conversation between 2 users
router.get("/find/:firstUserId/:secondUserId", async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      members: { $all: [req.params.firstUserId, req.params.secondUserId] },
    });
    res.status(200).json({
      success: true,
      message: "Conversation Fetched Successfully",
      data: conversation,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

module.exports = router;
