import multer from "multer";

import { uploadToCloudinary } from "../../Units/uploadToCloudinary.js"
// ===============================================
// MULTER
// ===============================================

const storage = multer.memoryStorage();

export const upload = multer({
  storage,

  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

// ===============================================
// IMAGE UPLOAD
// ===============================================

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No image uploaded",
      });
    }

    const result = await uploadToCloudinary(
      req.file.buffer,

      "chat-images",

      "image",
    );

    res.status(200).json({
      success: true,

      type: "image",

      url: result.secure_url,

      public_id: result.public_id,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// ===============================================
// AUDIO UPLOAD
// ===============================================

export const uploadAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No audio uploaded",
      });
    }

    const result = await uploadToCloudinary(
      req.file.buffer,

      "voice-messages",

      "video",
    );

    res.status(200).json({
      success: true,

      type: "audio",

      url: result.secure_url,

      public_id: result.public_id,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// ===============================================
// DOCUMENT UPLOAD
// ===============================================

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No document uploaded",
      });
    }

    const result = await uploadToCloudinary(
      req.file.buffer,

      "chat-documents",

      "auto",
    );

    res.status(200).json({
      success: true,

      type: "document",

      url: result.secure_url,

      fileName: req.file.originalname,

      public_id: result.public_id,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// ===============================================
// ANY FILE
// ===============================================

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const result = await uploadToCloudinary(
      req.file.buffer,

      "chat-files",

      "auto",
    );

    res.status(200).json({
      success: true,

      type: "file",

      url: result.secure_url,

      fileName: req.file.originalname,

      public_id: result.public_id,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// ===============================================
// DELETE FILE
// ===============================================

export const deleteFile = async (req, res) => {
  try {
    const { public_id } = req.body;

    await cloudinary.uploader.destroy(public_id, {
      resource_type: "image",
    });

    res.status(200).json({
      success: true,
      message: "File deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// ===============================================
// FILE INFO
// ===============================================

export const getFileInfo = async (req, res) => {
  try {
    res.status(200).json({
      publicId: req.params.publicId,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
