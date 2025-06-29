const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const passport = require("passport"); 
require("dotenv").config();

const { router: authRoute, verifyTokens } = require("./routes/auth");
const tasksRoute = require("./routes/tasks/task");
const friendsRoute = require("./routes/friends");
const userRoute = require("./routes/users");
const conversationRoute = require("./routes/dm/conversation");
const messageRoute = require("./routes/dm/messages");
const googleCalendarRoutes = require("./routes/dashboard/googleCalendar");

const User = require("./models/Auth/User");
const OTP = require("./models/Auth/OTP");

const path = require("path");
const serverRoute = require("./routes/servers/serverRoutes");
const channelRoute = require("./routes/servers/channelRoutes");
const writingRoutes = require("./routes/writing/writing");
const emailRoutes = require("./routes/email");
const templateRoutes = require("./routes/template");
const dashCommentRoutes = require("./routes/dashboard/dashComment");
const appointmentRoutes = require("./routes/dashboard/appointment");
const meetingRoute = require("./routes/meeting");
const webhookRoute = require("./routes/webhook");
const analyticsRoutes = require("./routes/analytics"); 
const moodRoutes = require("./routes/moods"); // Add this line

const app = express();

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MongoDB Connection
mongoose
  .connect(process.env.DB_CONNECTION_STRING)
  .then(() => console.log("DB Connected Successfully"))
  .catch((error) => {
    console.error("DB Connection Failed:", error.message);
    process.exit(1);
  });

  const allowedOrigins = [
  'http://localhost:5173',
  'https://worklyft-alpha.vercel.app'
];

// Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-csrf-token",
      "ngrok-skip-browser-warning",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize()); // Initialize Passport middleware

// Routes
app.use("/auth", authRoute);
app.use("/tasks", verifyTokens, tasksRoute);
app.use("/servers", verifyTokens, serverRoute); 
app.use("/channels", verifyTokens, channelRoute);
app.use("/api/writings", writingRoutes);
app.use("/api/email", emailRoutes); 

app.use("/api/templates", verifyTokens, templateRoutes);
app.use("/api/appointments", verifyTokens, appointmentRoutes);
app.use("/api/dashcomments", verifyTokens, dashCommentRoutes);
app.use("/webhook", webhookRoute); 
app.use("/api/google-calendar", verifyTokens, googleCalendarRoutes);
app.use("/api/analytics", verifyTokens, analyticsRoutes);
app.use("/api/moods", verifyTokens, moodRoutes); 

app.post("/verify-tokens", verifyTokens, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Token Validated and Updated",
    id: req.user.id,
  });
});

app.use(verifyTokens);

app.use("/users", userRoute);
app.use("/tasks", tasksRoute);
app.use("/friends", friendsRoute);
app.use("/conversations", conversationRoute);
app.use("/messages", messageRoute);
app.use("/meetings", meetingRoute);
app.get("/get-user", async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Start Server
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
