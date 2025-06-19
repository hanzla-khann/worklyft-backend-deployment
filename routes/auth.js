const express = require("express");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const jwt = require("jsonwebtoken");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/Auth/User");
const OTP = require("../models/Auth/OTP");

const { sendOtp } = require("../utils/generateOtp");

const AccessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const RefreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

passport.use(
  new GoogleStrategy(
    {
      clientID:
        "458898494944-2unrnoldtgo1augmdgs3q9030tgelarf.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL: "http://localhost:4000/auth/google/callback",
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        let user = await User.findOne({ email });

        if (user) {
          user.googleId = profile.id;
          user.oauth = true;

          if (refreshToken && !user.googleRefreshToken) {
            user.googleRefreshToken = refreshToken;
          }

          if (accessToken) {
            user.googleAccessToken = accessToken;
          }

          await user.save();
        } else {
          user = new User({
            username: profile.displayName,
            email,
            googleId: profile.id,
            password: null,
            oauth: true,
            googleRefreshToken: refreshToken || null,
            googleAccessToken: accessToken || null,
            servers: [],
            friends: [],
          });
          await user.save();
        }

        return done(null, { ...user.toObject(), accessToken });
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

router.get("/google", (req, res, next) => {
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://mail.google.com/",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly" 
    ],
    accessType: "offline",
    prompt: "consent",
    session: false,
  })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/google/failure",
    session: false,
  }),
  async (req, res) => {
    try {
      const user = req.user;

      const appAccessToken = jwt.sign(
        {
          id: user._id,
          email: user.email,
          username: user.username,
        },
        AccessTokenSecret,
        { expiresIn: "1h" }
      );

      const appRefreshToken = jwt.sign(
        {
          id: user._id,
          email: user.email,
        },
        RefreshTokenSecret,
        { expiresIn: "7d" }
      );

      res.cookie("accessToken", appAccessToken, {
        httpOnly: true,
        sameSite: "Lax",
        maxAge: 30 * 60 * 1000,
      });

      res.cookie("refreshToken", appRefreshToken, {
        httpOnly: true,
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.cookie("userId", user._id.toString(), {
        httpOnly: false,
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.redirect("http://localhost:5173/dashboard");
    } catch (error) {
      res.status(500).json({ success: false, message: "Authentication error" });
    }
  }
);

router.get("/google/failure", (req, res) => {
  res
    .status(401)
    .json({ success: false, message: "Google Authentication Failed" });
});

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Middleware to protect routes

async function verifyTokens(req, res, next) {
  let accessToken = req.cookies.accessToken;
  let refreshToken = req.cookies.refreshToken;
  if (!accessToken) {
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Session Expired, Login Again",
      });
    }
    generateTokens(req, res, next, refreshToken);
  } else {
    try {
      let decoded = jwt.verify(accessToken, AccessTokenSecret);
      req.user = decoded;
      next();
    } catch (error) {
      console.log("Error: ", error);
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Session Expired, Login Again",
        });
      }
      // OAuth Token Case (Google, Facebook, etc.)
      // Chud sakta hai
      if (accessToken.startsWith("ya29.") || accessToken.includes(".")) {
        console.log(
          "OAuth Token detected. Fetching user and refreshToken from DB."
        );
        try {
          const user = await User.findById(req.cookies.userId); // Assuming you have userId in cookies
          if (user) {
            req.user = {
              oauth: true,
              token: accessToken,
              email: user.email, // Add email
              refreshToken: user.refreshToken, // Add refreshToken
            };
          } else {
            return res.status(401).json({
              success: false,
              message: "User not found",
            });
          }
        } catch (dbError) {
          console.error("Error fetching user from DB:", dbError);
          return res.status(500).json({
            success: false,
            message: "Database error",
          });
        }
        return next();
      }
      return generateTokens(req, res, next, refreshToken);
    }
  }
}

// JWT Token Generation
function generateTokens(req, res, next, refreshToken) {
  try {
    let decoded = jwt.verify(refreshToken, RefreshTokenSecret);
    req.user = decoded;
    let accessToken = jwt.sign(
      {
        id: decoded.id,
        email: decoded.email,
      },
      AccessTokenSecret,
      {
        expiresIn: "30m",
      }
    );

    res.cookie("accessToken", accessToken, {
      httpOnly: false,
      withCredentials: true,
      secure: true,
      sameSite: "None",
      maxAge: 30 * 60 * 1000,
    });

    let currentTime = Math.floor(Date.now() / 1000);
    let expirationTime = decoded.exp;

    if (expirationTime - currentTime <= 1 * 24 * 60 * 60) {
      const newRefreshToken = jwt.sign(
        { id: decoded.id, email: decoded.email },
        RefreshTokenSecret,
        { expiresIn: "7d" }
      );

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    next();
  } catch (error) {
    console.log("Error: ", error);
    return res.status(401).json({
      success: false,
      message: "Session Expired, Login Again",
    });
  }
}

router.post("/login", async (req, res) => {
  try {
    let user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid Username or Password",
      });
    }

    let isValidPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid Username or Password",
      });
    }

    if (!user.isVerified) {
      return res.status(200).json({
        success: false,
        message: "Please verify your account",
      });
    }

    const accessToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
      },
      AccessTokenSecret,
      {
        expiresIn: "30m",
      }
    );

    const refreshToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
      },
      RefreshTokenSecret,
      {
        expiresIn: "7d",
      }
    );

    res.cookie("accessToken", accessToken, {
      withCredentials: true,
      httpOnly: false,
      secure: true,
      sameSite: "None",
      maxAge: 30 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      withCredentials: true,
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "User Authenticated Successfully",
      user: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
});

router.get("/logout", async (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  return res.status(200).json({ message: "User Logged out successfully" });
});

router.post("/signup", async (req, res) => {
  try {
    let salt = await bcrypt.genSalt();
    let password = await bcrypt.hash(req.body.password, salt);
    let result = await User.create({
      username: req.body.username,
      email: req.body.email,
      password: password,
    });
    return res.status(200).json({
      success: true,
      message: "User Created",
    });
  } catch (error) {
    console.log("Error Creating User: ", error);
    return res.status(400).json({
      success: false,
      message: "Error Creating User",
    });
  }
});

router.put("/verify-user", async (req, res) => {
  try {
    await User.findOneAndUpdate(
      { email: req.body.email },
      { isVerified: true }
    );
    return res.status(200).json({
      success: true,
      message: "User Verified Successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to Verify User",
    });
  }
});

router.post("/send-otp", async (req, res) => {
  try {
    sendOtp(req.body.email);
    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    let otp = await OTP.findOneAndDelete({ otp: req.body.otpString });
    if (!otp) {
      return res.json({
        success: false,
        message: "Invalid OTP",
      });
    }
    return res.json({
      success: true,
      message: "OTP Verified",
    });
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.post("/change-password", async (req, res) => {
  try {
    let user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.json({
        success: false,
        message: "Invalid Email: No User Found",
      });
    }
    const salt = await bcrypt.genSalt();
    const password = await bcrypt.hash(req.body.password, salt);
    user.password = password;
    await user.save();
    return res.json({
      success: true,
      message: "Password Changed Successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Interval Server Error",
    });
  }
});

module.exports = { router, verifyTokens };
