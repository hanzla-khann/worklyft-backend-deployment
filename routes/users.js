const router = require("express").Router();
const multer = require("multer");
const bcrypt = require("bcryptjs");
const User = require("../models/Auth/User");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

router.get("/:friendID", async (req, res) => {
  try {
    let friend = await User.findById(req.params.friendID);
    let currentUser = await User.findById(req.user.id);

    let data = {
      currentUser: currentUser,
      friend: friend,
    };
    return res.status(200).json({
      success: true,
      message: "Data fetched Successfully",
      data: data,
    });
  } catch (error) {}
});

router.post("/onboarding-complete", async (req, res) => {
  try {
    let user = await User.findByIdAndUpdate(
      req.user.id,
      { onboardingDone: true },
      { new: true }
    );
    return res.status(200).json({
      success: true,
      message: "Onboarding Completed",
      user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.put("/update-data", upload.single("profileImg"), async (req, res) => {
  try {
    let user = await User.findById(req.user.id);
    if (req.body.username) {
      user.username = req.body.username;
    }
    if (req.body.jobTitle) {
      user.jobTitle = req.body.jobTitle;
    }
    if (req.file) {
      user.profileImg = `/uploads/${req.file.filename}`;
    }
    if (req.body.password) {
      let salt = await bcrypt.genSalt();
      let password = await bcrypt.hash(req.body.password, salt);
      user.password = password;
    }
    await user.save();
    return res.status(200).json({
      success: true,
      message: "Profile Updated Successfully",
      user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to Update Profile",
    });
  }
});

module.exports = router;
