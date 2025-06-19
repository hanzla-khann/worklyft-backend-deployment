const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const Channel = require("../../models/Servers/channel");
const Server = require("../../models/Servers/server");
const Message = require("../../models/DM/Message");
const { findById } = require("../../models/Friend");

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Add a new channel
router.post("/create-channel", async (req, res) => {
  const { name, type, serverID } = req.body;

  try {
    const server = await Server.findById(serverID);

    let existingChannel = await Channel.findOne({
      server: serverID,
      type: type,
      name: name,
    });

    if (existingChannel)
      return res.status(500).json({
        success: false,
        message: "A Channel with same name already exists",
      });

    const members = server.members.map((member) => member.user);

    let channel = await Channel.create({
      name,
      type,
      server: serverID,
    });

    type === "text" ? (channel.members = members) : null;
    await channel.save();

    channel = await channel.populate("members");

    let channelServer = await Server.findById(serverID);

    type === "text"
      ? channelServer.textChannels.push(channel._id)
      : channelServer.voiceChannels.push(channel._id);

    await channelServer.save();

    res.status(201).json({
      success: true,
      data: channel,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:channelID", async (req, res) => {
  const { name, members } = req.body;
  if (!name || !Array.isArray(members)) {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }

  try {
    let updated = await Channel.findByIdAndUpdate(
      req.params.channelID,
      {
        name,
        members: members.map((id) => new mongoose.Types.ObjectId(id)),
      },
      { new: true }
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Channel not found" });
    }
    updated = await updated.populate("members");
    const server = await Server.findById(updated.server)
      .populate({
        path: "textChannels",
        populate: { path: "members" },
      })
      .populate("voiceChannels")
      .populate("members.user");
    if (!server) {
      return res
        .status(404)
        .json({ success: false, message: "Server not found" });
    }
    res.json({ success: true, channel: updated, server });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update channel" });
  }
});

router.get("/:channelID/unassigned-members", async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelID);
    if (!channel)
      return res
        .status(404)
        .json({ success: false, message: "Channel not found" });

    const server = await Server.findById(channel.server).populate(
      "members.user"
    );
    if (!server)
      return res
        .status(404)
        .json({ success: false, message: "Server not found" });

    const inChannel = new Set(channel.members.map((id) => id.toString()));
    const unassigned = server.members
      .filter((m) => !inChannel.has(m.user._id.toString()))
      .map((m) => m.user);
    res.status(200).json({ success: true, members: unassigned });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch members" });
  }
});

// Get all channels for a server
router.get("/server/:serverId", async (req, res) => {
  const { serverId } = req.params;
  try {
    
    const channels = await Channel.find({ server: serverId }); 
    res.status(200).json(channels); 
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:channelID/messages", async (req, res) => {
  try {
    const channelID = req.params.channelID;
    let messages = await Message.find({ channelID: channelID }).populate(
      "senderID"
    );
    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

router.post(
  "/:channelID/create-message",
  upload.single("file"),
  async (req, res) => {
    try {
      let message;
      if (req.file) {
        message = new Message();
        message.text = req.file.originalname;
        message.filePath = req.file.path;
        message.senderID = req.body.senderID;
        message.channelID = req.body.conversationID;
        message.isFile = true;
        await message.save();
      } else {
        const text = req.body.message;
        const channelID = req.params.channelID;
        message = await Message.create({
          text: text,
          channelID: channelID,
          senderID: req.user.id,
        });
      }

      message = await message.populate("senderID");
      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;


