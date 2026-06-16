const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
const admin = require("firebase-admin");
require("dotenv").config();
const EmailList = require("./models/EmailList");
const connectDB = require("./config/db");
const { initFirebaseAdmin } = require("./config/firebaseAdmin");
const { verifyToken } = require("./middleware/auth");

// Connect to MongoDB
connectDB();

initFirebaseAdmin();

const app = express();
const PORT = process.env.PORT || 5000;
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ];

app.use(cors({
  origin: corsOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// Health check — lets the uptime pinger keep the free instance warm
app.get("/health", (req, res) => res.json({ status: "ok" }));

let emailProgress = new Map();

function extractNameFromEmail(email) {
  const localPart = email.split("@")[0];
  const nameParts = localPart
    .split(/[._]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  return nameParts.join(" ");
}

// Toggle admin status
app.post("/toggle-admin", verifyToken, async (req, res) => {
  const { targetUserEmail } = req.body;
  const mainAdminEmail = process.env.MAIN_ADMIN_EMAIL;

  try {
    const adminRecord = await admin.auth().getUser(req.user.uid);
    if (!adminRecord.customClaims?.admin) {
      return res
        .status(403)
        .json({ error: "Not authorized to modify admin status" });
    }

    // Protect main admin
    if (targetUserEmail === mainAdminEmail) {
      return res.status(403).json({ error: "Cannot modify main admin status" });
    }

    // Toggle admin status
    const targetUser = await admin.auth().getUserByEmail(targetUserEmail);
    const currentClaims =
      (await admin.auth().getUser(targetUser.uid)).customClaims || {};

    await admin.auth().setCustomUserClaims(targetUser.uid, {
      ...currentClaims,
      admin: !currentClaims.admin,
    });

    res.json({ message: "Admin status updated successfully" });
  } catch (error) {
    console.error("Error toggling admin status:", error);
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(500).json({ error: "Failed to update admin status" });
  }
});

// Get all authorized users
app.get("/authorized-users", verifyToken, async (req, res) => {
  try {
    console.log("Fetching authorized users...");
    const listUsers = await admin.auth().listUsers();
    const authorizedUsers = listUsers.users
      .filter((user) => user.customClaims?.authorized)
      .map((user) => ({
        email: user.email,
        isAdmin: user.customClaims?.admin || false,
      }));
    res.json({ users: authorizedUsers });
  } catch (error) {
    console.error("Error fetching authorized users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Endpoint to grant access
app.post("/grant-access", verifyToken, async (req, res) => {
  const { userEmailToGrant } = req.body;
  console.log("Attempting to grant access:", {
    adminEmail: req.user.email,
    userEmailToGrant,
  });

  try {
    const adminRecord = await admin.auth().getUser(req.user.uid);
    if (!adminRecord.customClaims?.admin) {
      return res.status(403).json({ error: "Not authorized as admin" });
    }

    const userToGrant = await admin.auth().getUserByEmail(userEmailToGrant);
    await admin
      .auth()
      .setCustomUserClaims(userToGrant.uid, { authorized: true });

    console.log("Access granted successfully to:", userEmailToGrant);
    res.json({ message: "Access granted successfully" });
  } catch (error) {
    console.error("Error granting access:", error);
    if (error.code === "auth/user-not-found") {
      // Message must contain "no user record" — frontend matches on it
      return res
        .status(404)
        .json({ error: "no user record found for that email" });
    }
    res.status(500).json({ error: "Failed to grant access" });
  }
});

app.get("/send-emails/progress", (req, res) => {
  const { sendId } = req.query;
  if (!sendId) {
    return res.status(400).json({ error: "sendId is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  emailProgress.set(sendId, res);

  req.on("close", () => {
    emailProgress.delete(sendId);
  });
});

app.post("/send-emails", verifyToken, upload.array("attachments"), async (req, res) => {
  const { valid, subject, body, senderEmail, appPassword, sendId } = req.body;
  const files = req.files;
  let hasResponded = false;

  let recipients;
  try {
    recipients = JSON.parse(valid);
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error("empty or not an array");
    }
  } catch {
    return res.status(400).json({ error: "Invalid recipient list" });
  }

  if (
    !recipients.every(
      (r) => r && typeof r.email === "string" && r.email.includes("@")
    )
  ) {
    return res.status(400).json({ error: "Invalid recipient list" });
  }

  if (!subject || !body) {
    return res.status(400).json({ error: "Subject and body are required" });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: senderEmail || process.env.EMAIL_USER,
      pass: appPassword || process.env.EMAIL_PASS,
    },
  });

  for (const recipient of recipients) {
    const name = recipient.name || extractNameFromEmail(recipient.email);
    const personalizedSubject = subject.replace(/{name}/g, name);
    const personalizedMessage = body.replace(/{name}/g, name);

    try {
      await transporter.sendMail({
        from: senderEmail,
        to: recipient.email,
        subject: personalizedSubject,
        text: personalizedMessage,
        attachments: files
          ? files.map((file) => ({
              filename: file.originalname,
              content: file.buffer,
            }))
          : [],
      });
      console.log(`Email sent to: ${recipient.email}`);
      // Send progress only to the client that started this send
      const progressClient = emailProgress.get(sendId);
      if (progressClient) {
        progressClient.write(
          `data: ${JSON.stringify({ email: recipient.email })}\n\n`
        );
      }
    } catch (error) {
      console.error(`Failed to send email to ${recipient.email}:`, error);
      if (!hasResponded) {
        hasResponded = true;
        return res.status(500).json({
          error:
            "Failed to send email. Check the sender email and app password.",
        });
      }
    }
  }
  
  if (!hasResponded) {
    res.json({ success: true });
  }
});

app.post("/revoke-access", verifyToken, async (req, res) => {
  const { userEmailToRevoke } = req.body;

  try {
    const adminRecord = await admin.auth().getUser(req.user.uid);
    if (!adminRecord.customClaims?.admin) {
      return res.status(403).json({ error: "Not authorized as admin" });
    }

    const userToRevoke = await admin.auth().getUserByEmail(userEmailToRevoke);
    await admin.auth().setCustomUserClaims(userToRevoke.uid, null);

    res.json({ message: "Access revoked successfully" });
  } catch (error) {
    console.error("Error revoking access:", error);
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

// Create new list — owner is always the authenticated user
app.post("/api/lists", verifyToken, async (req, res) => {
  try {
    const list = new EmailList({
      userId: req.user.uid,
      listName: req.body.listName,
      emails: [],
    });
    await list.save();
    res.json(list);
  } catch (error) {
    console.error("Error creating list:", error);
    res.status(500).json({ error: "Failed to create list" });
  }
});

// Get all lists for the authenticated user
app.get("/api/lists", verifyToken, async (req, res) => {
  try {
    const lists = await EmailList.find({ userId: req.user.uid });
    res.json(lists);
  } catch (error) {
    console.error("Error fetching lists:", error);
    res.status(500).json({ error: "Failed to fetch lists" });
  }
});

// Add email to list (only if owned by the authenticated user)
app.post("/api/lists/:listId/emails", verifyToken, async (req, res) => {
  try {
    const list = await EmailList.findOneAndUpdate(
      { _id: req.params.listId, userId: req.user.uid },
      { $push: { emails: { $each: req.body.emails } } },
      { new: true }
    );
    if (!list) return res.status(404).json({ error: "List not found" });
    res.json(list);
  } catch (error) {
    console.error("Error adding emails:", error);
    res.status(500).json({ error: "Failed to add emails" });
  }
});

// Remove email from list (only if owned by the authenticated user)
app.delete("/api/lists/:listId/emails/:email", verifyToken, async (req, res) => {
  try {
    const list = await EmailList.findOneAndUpdate(
      { _id: req.params.listId, userId: req.user.uid },
      { $pull: { emails: req.params.email } },
      { new: true }
    );
    if (!list) return res.status(404).json({ error: "List not found" });
    res.json(list);
  } catch (error) {
    console.error("Error removing email:", error);
    res.status(500).json({ error: "Failed to remove email" });
  }
});

// Delete list (only if owned by the authenticated user)
app.delete("/api/lists/:listId", verifyToken, async (req, res) => {
  try {
    const list = await EmailList.findOneAndDelete({
      _id: req.params.listId,
      userId: req.user.uid,
    });
    if (!list) return res.status(404).json({ error: "List not found" });
    res.json({ message: "List deleted successfully" });
  } catch (error) {
    console.error("Error deleting list:", error);
    res.status(500).json({ error: "Failed to delete list" });
  }
});

// Attachment limit errors from multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ error: "Attachments too large (max 10 MB per file, 5 files)" });
  }
  next(err);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
