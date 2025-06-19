const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const Server = require("../../models/Servers/server");
const Channel = require("../../models/Servers/channel");
const ServerInvite = require("../../models/Servers/serverInvite");
const { voiceChannelUsers } = require("../../socket");

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

router.post("/", upload.single("icon"), async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Server name is required." });
  }

  try {
    const userId = req.user.id;

    const profileImg = req.file
      ? `/uploads/${req.file.filename}`
      : "/uploads/server.png";

    const newServer = new Server({
      name,
      owner: userId,
      profileImg,
      members: [{ user: userId, role: "owner" }],
    });

    const textChannel = await Channel.create({
      name: "General",
      type: "text",
      server: newServer._id,
    });

    const voiceChannel = await Channel.create({
      name: "General Voice",
      type: "voice",
      server: newServer._id,
    });

    newServer.textChannels.push(textChannel._id);
    newServer.voiceChannels.push(voiceChannel._id);

    await newServer.save();

    res.status(201).json({
      success: true,
      data: newServer,
    });
  } catch (error) {
    console.error("Error creating server:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the server." });
  }
});

router.put("/:serverID", upload.single("icon"), async (req, res) => {
  try {
    const { serverID } = req.params;
    let server = await Server.findById(serverID)
      .populate("members.user")
      .populate("textChannels")
      .populate("voiceChannels");
    if (!server) {
      return res.status(404).json({
        success: false,
        message: "Server not found",
      });
    }
    if (req.body.name) {
      server.name = req.body.name;
    }
    if (req.body.description) {
      server.description = req.body.description;
    }
    if (req.file) {
      server.profileImg = `/uploads/${req.file.filename}`;
    }

    await server.save();

    return res.status(200).json({
      success: true,
      message: "Server Updated Successfully",
      server,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to Update Server" });
  }
});

router.get("/", async (req, res) => {
  try {
    const servers = await Server.find({
      "members.user": req.user.id,
    })
      .populate("textChannels")
      .populate("voiceChannels");

    res.status(200).json({
      success: true,
      data: servers,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/user-joined-servers", async (req, res) => {
  try {
    let user = req.user;
    const servers = await Server.find({
      "members.user": user.id,
    });
    res.status(200).json({
      success: true,
      data: servers,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.get("/server-details/:serverID", async (req, res) => {
  try {
    let serverId = req.params.serverID;
    let server = await Server.findById(serverId)
      .populate({
        path: "textChannels",
        populate: { path: "members" },
      })
      .populate("voiceChannels")
      .populate("members.user")
      .populate("members.roles");
    res.status(200).json({
      success: true,
      data: server,
      users: voiceChannelUsers,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.get("/:serverID/members", async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverID).populate(
      "members.user"
    );
    return res.status(200).json({
      success: true,
      members: server.members,
      totalMembers: server.members?.length ?? 0,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to Fetch Members",
    });
  }
});

router.put("/:serverID/members/:memberID", async (req, res) => {
  try {
    const { serverID, memberID } = req.params;
    const { roles } = req.body;
    const server = await Server.findById(serverID)
      .populate("members.user")
      .populate("members.roles");
    if (!server) {
      return res.status(404).json({
        success: false,
        message: "Server not found",
      });
    }
    const member = server.members.id(memberID);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }
    member.roles = roles;
    await server.save();
    return res.status(200).json({
      success: true,
      message: "Member roles updated",
      member,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to Update Member",
    });
  }
});

// ----Server Invites----

router.get("/server-invites", async (req, res) => {
  try {
    const user = req.user.id;
    const servers = await ServerInvite.find({ receiver: user })
      .populate("sender")
      .populate("server");
    res.status(200).json({
      success: true,
      data: servers,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.post("/invite-user", async (req, res) => {
  try {
    const { sender, receiver, server } = req.body;
    await ServerInvite.create({
      sender,
      receiver,
      server,
    });
    res.status(201).json({
      success: true,
      message: "Invite sent successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.delete("/reject-invite/:inviteID", async (req, res) => {
  try {
    await ServerInvite.findByIdAndDelete({ _id: req.params.inviteID });
    res.status(200).json({
      success: true,
      message: "Invite Rejected Successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.put("/accept-invite/:inviteID", async (req, res) => {
  try {
    const invite = await ServerInvite.findById({
      _id: req.params.inviteID,
    })
      .populate("server")
      .populate("receiver");
    const server = await Server.findByIdAndUpdate(
      invite.server._id,
      {
        $push: { members: { user: invite.receiver._id, roles: ["member"] } },
      },
      { new: true }
    );
    await ServerInvite.findByIdAndDelete(req.params.inviteID);
    res.status(200).json({
      success: true,
      message: "Invite Accepted Successfully",
      server,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// ----Members----
router.delete("/:serverID/members/:memberID", async (req, res) => {
  try {
    const server = await Server.findByIdAndUpdate(
      req.params.serverID,
      {
        $pull: {
          members: { _id: new mongoose.Types.ObjectId(req.params.memberID) },
        },
      },
      { new: true }
    );
    res.status(200).json({
      success: true,
      message: "Member removed successfully",
      server,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove member",
    });
  }
});

// Get all servers for a user
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    // Fetch all servers associated with the user
    const servers = await Server.find({ userId }) // Use find() for MongoDB
      .populate("channels"); // Assuming you have a "channels" field in the Server model

    if (servers.length === 0) {
      return res
        .status(404)
        .json({ message: "No servers found for this user" });
    }

    res.status(200).json(servers);
  } catch (error) {
    console.error("Error fetching servers:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
