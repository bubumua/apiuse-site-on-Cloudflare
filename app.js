const express = require("express");
const multer = require("multer");
const path = require("path");
const CryptoJS = require("crypto-js");
const request = require("request");
const fs = require("fs");

const app = express();
const port = 3000;

// Multer configuration for handling file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB limit
});

// Serve static files
app.use(express.static("public"));

// API endpoints
app.post("/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // API Configuration
  const config = {
    hostUrl: "https://rest-api.xfyun.cn/v2/itr",
    host: "rest-api.xfyun.cn",
    appid: "c289d671",
    apiSecret: "MWU0ODhhZWRhY2ZhZGYxNGUyNzEzNzUw",
    apiKey: "216b9d113fe87ffe01b2811601d29cfe",
    uri: "/v2/itr",
    file: req.file.path,
  };

  // Generate API request
  const date = new Date().toUTCString();
  const postBody = getPostBody(config);
  const digest = getDigest(postBody);

  const options = {
    url: config.hostUrl,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json,version=1.0",
      Host: config.host,
      Date: date,
      Digest: digest,
      Authorization: getAuthStr(date, digest, config),
    },
    json: true,
    body: postBody,
  };

  // Make API request
  request.post(options, (err, response, body) => {
    if (err) {
      return res.status(500).json({ error: "API call failed" });
    }
    res.json(body);

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting file:", err);
    });
  });
});

// Helper functions for API request
function getPostBody(config) {
  const buffer = fs.readFileSync(config.file);
  return {
    common: { app_id: config.appid },
    business: {
      ent: "teach-photo-print",
      aue: "raw",
    },
    data: {
      image: buffer.toString("base64"),
    },
  };
}

function getDigest(body) {
  return (
    "SHA-256=" +
    CryptoJS.enc.Base64.stringify(CryptoJS.SHA256(JSON.stringify(body)))
  );
}

function getAuthStr(date, digest, config) {
  const signatureOrigin = `host: ${config.host}\ndate: ${date}\nPOST ${config.uri} HTTP/1.1\ndigest: ${digest}`;
  const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret);
  const signature = CryptoJS.enc.Base64.stringify(signatureSha);
  return `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line digest", signature="${signature}"`;
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
