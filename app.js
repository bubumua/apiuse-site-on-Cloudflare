const express = require("express");
const multer = require("multer");
const path = require("path");
const CryptoJS = require("crypto-js");
// const request = require("request");
const axios = require("axios"); // 替换为axios
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
  const postBodyString = JSON.stringify(postBody); // 关键修改：预序列化JSON
  const digest = getDigest(postBodyString); // 使用字符串生成摘要

  try {
    const response = await axios.post(config.hostUrl, postBodyString, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json,version=1.0",
        Host: config.host,
        Date: date,
        Digest: digest,
        Authorization: getAuthStr(date, digest, config),
      },
      validateStatus: () => true, // 接受所有响应状态码
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "API call failed" });
  } finally {
    fs.unlink(req.file.path, (err) => {
      // 确保清理文件
      if (err) console.error("Error deleting file:", err);
    });
  }
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

function getDigest(bodyString) {
  // 改为接收字符串
  return (
    "SHA-256=" + CryptoJS.enc.Base64.stringify(CryptoJS.SHA256(bodyString))
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
