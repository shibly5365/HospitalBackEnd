import express from "express";
import {
  createCommunity,
  getCommunities,
  joinCommunity,
  leaveCommunity,
  approveMemberRequest,
  rejectMemberRequest,
  removeMember,
  getCommunityDetails,
} from "../../Controllers/Messages/communityController.js";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";

const communityRouter = express.Router();

// ===============================================
// COMMUNITIES
// ===============================================

// Create community (admin only)
communityRouter.post(
  "/create",
  AuthMiddleware(["admin"]),
  createCommunity
);

// Get all communities (based on role)
communityRouter.get(
  "/",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  getCommunities
);

// Get community details
communityRouter.get(
  "/:communityId",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  getCommunityDetails
);

// Join community
communityRouter.post(
  "/:communityId/join",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  joinCommunity
);

// Leave community
communityRouter.post(
  "/:communityId/leave",
  AuthMiddleware(["patient", "doctor", "admin", "receptionist"]),
  leaveCommunity
);

// Approve member request (admin only)
communityRouter.post(
  "/:communityId/approve/:userId",
  AuthMiddleware(["admin"]),
  approveMemberRequest
);

// Reject member request (admin only)
communityRouter.post(
  "/:communityId/reject/:userId",
  AuthMiddleware(["admin"]),
  rejectMemberRequest
);

// Remove member (admin only)
communityRouter.post(
  "/:communityId/remove/:userId",
  AuthMiddleware(["admin"]),
  removeMember
);

export default communityRouter;
