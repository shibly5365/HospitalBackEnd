import express from "express";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import {
  endVideoCall,
  generateVideoCallRoom,
  getVideoCallStatus,
} from "../../Controllers/patient/VideoCall.js";

const VideoCallRouting = express.Router();

VideoCallRouting.post(
  "/video-call/:appointmentId",
  AuthMiddleware(["patient", "doctor"]),
  generateVideoCallRoom
);

VideoCallRouting.get(
  "/video-call-status/:appointmentId",
  AuthMiddleware(["patient", "doctor"]),
  getVideoCallStatus
);

VideoCallRouting.put(
  "/video-call-end/:appointmentId",
  AuthMiddleware(["patient", "doctor"]),
  endVideoCall
);

export default VideoCallRouting;
