// server.js
import express from "express";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import cors from "cors";

dotenv.config();

const app = express();
const port = 3000;

// Enable CORS for local frontend (adjust origin if needed)
app.use(cors({ origin: "http://localhost:5173" }));

// Temporary storage for uploaded audio
const upload = multer({ dest: "uploads/" });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint to receive audio and transcribe
app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1",
    });

    // Delete temp file
    fs.unlinkSync(req.file.path);

    res.json({ text: transcription.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Transcription failed" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});