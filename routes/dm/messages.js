const router = require("express").Router();
const multer = require("multer");
const Message = require("../../models/DM/Message");
const Conversation = require("../../models/DM/Conversation");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

router.post("/upload-file", upload.single("file"), async (req, res) => {
  try {
    console.log(req.body);
    console.log(req.file);
    return res.json({
      success: true,
      message: "File Uploaded Successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Create New Message
router.post("/add-message", upload.single("file"), async (req, res) => {
  try {
    let message;
    if (req.file) {
      message = new Message();
      message.text = req.file.originalname;
      message.filePath = req.file.path;
      message.senderID = req.body.senderID;
      message.conversationID = req.body.conversationID;
      message.isFile = true;
      await message.save();
    } else {
      message = await Message.create(req.body);
    }
    message = await message.populate("senderID");

    if (message.conversationID) {
      let conversation = await Conversation.findById(message.conversationID);
      conversation.lastMessage = message._id;
      await conversation.save();
    }

    res.status(200).json({
      success: true,
      message: "Message Created Successfully",
      data: message,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Get Message
router.get("/:conversationId", async (req, res) => {
  try {
    const messages = await Message.find({
      conversationID: req.params.conversationId,
    }).populate("senderID");
    res.status(200).json({
      success: true,
      message: "Messages Fetched Successfully",
      data: messages,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    let message = await Message.findById(req.params.id);
    message.deleted = true;
    await message.save();
    res.status(200).json({
      success: true,
      message: "Message Deleted Successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    let message = await Message.findById(req.params.id).populate("senderID");
    message.text = req.body.message.text;
    message.edited = true;
    await message.save();
    res.status(200).json({
      success: true,
      message: "Message Edited Successfully",
      data: message,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
