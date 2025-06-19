const router = require("express").Router();

const User = require("../models/Auth/User");
const Friendship = require("../models/Friend");

// Search Users by Username
router.get("/fetch-users-by-username/:username", async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    const users = await User.find({
      username: { $regex: `^${username}`, $options: "i" },
      _id: { $ne: req.user.id },
    }).populate("friends");

    if (users.length == 0) {
      return res.json({ success: false, message: "No User Found!" });
    } else {
      return res.json({ success: true, data: users });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Fetch all Friends
router.get("/fetch-all-friends", async (req, res) => {
  try {
    let friends = await Friendship.find({
      $or: [{ recipient: req.user.id }, { requestor: req.user.id }],
      status: "friends",
    })
      .populate("requestor")
      .populate("recipient");

    return res.status(200).json({
      success: true,
      data: friends,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Fetch Friendship status with given users
router.get("/fetch-friendship", async (req, res) => {});

// Send Friend Request
router.post("/send-request/:friendID", async (req, res) => {
  try {
    let { friendID } = req.params;
    const existingRequest = await Friendship.findOne({
      $or: [
        { requestor: req.user.id, recipient: friendID },
        { requestor: friendID, recipient: req.user.id },
      ],
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending friend request with this user",
      });
    }

    let friendship = await Friendship.create({
      requestor: req.user.id,
      recipient: friendID,
      status: "pending",
    });

    await User.findByIdAndUpdate(req.user.id, {
      $push: { friends: friendship._id },
    });

    await User.findByIdAndUpdate(friendID, {
      $push: { friends: friendship._id },
    });
    res.json({ success: true, message: "Request Sent Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Accept Friend Request
router.post("/accept-request/:friendID", async (req, res) => {
  try {
    let { friendID } = req.params;
    let request = await Friendship.findOne({
      requestor: friendID,
      recipient: req.user.id,
    });

    request.status = "friends";
    await request.save();
    res.status(200).json({ success: true, message: "Request Accepted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Delete Friend Request
router.post("/delete-request/:friendID", async (req, res) => {
  try {
    let { friendID } = req.params;
    let request = await Friendship.findOneAndDelete({
      requestor: friendID,
      recipient: req.user.id,
    });

    await User.findByIdAndUpdate(req.user.id, {
      $pull: { friends: request._id },
    });

    await User.findByIdAndUpdate(friendID, {
      $pull: { friends: request._id },
    });

    res.status(200).json({ success: true, message: "Request Deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Fetch Friend Requests
router.get("/fetch-pending-requests", async (req, res) => {
  try {
    let requests = await Friendship.find({
      $and: [{ recipient: req.user.id }, { status: "pending" }],
    })
      .populate("recipient", "username")
      .populate("requestor", "username");
    res.status(200).json({
      success: true,
      message: "Data Fetched Successfully",
      requests,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Fetch Friends List
router.get("/fetch-friends-list", async (req, res) => {
  try {
    let friends = await Friendship.find({
      $or: [
        { $and: [{ recipient: req.user.id }, { status: "friends" }] },
        { $and: [{ requestor: req.user.id }, { status: "friends" }] },
      ],
    })
      .populate("recipient")
      .populate("requestor");
    res.status(200).json({
      success: true,
      message: "Data Fetched Successfully",
      friends,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

module.exports = router;
