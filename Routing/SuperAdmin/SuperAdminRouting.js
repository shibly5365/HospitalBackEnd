import express from "express";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import {
  CreateAdmin,
  DeleteAdmin,
  getAllAdmin,
  UpdatedAdmin,
  getSuperAdminDashboard,
  toggleBlockAdmin,
  getAdminDetails,
  getAllPayments,
  getPaymentsByDoctor,
  getComprehensiveAnalytics,
} from "../../Controllers/SuperAdmin/SuperAdminControllers.js";
import { upload } from "../../Config/multer.js";
import { LoginValidation } from "../../Middleware/AuthValidaction.js";
import {
  getConversation,
  sendMessage,
} from "../../Controllers/Messages/messages.js";
import { Login, Logout } from "../../Controllers/Auth/Units/AuthControllers.js";

const SuperAdminRouting = express.Router();

SuperAdminRouting.post("/Superadmin", LoginValidation, Login);
SuperAdminRouting.post("/Superadmin-logout", Logout);
SuperAdminRouting.get(
  "/dashboard",
  AuthMiddleware(["superadmin"]),
  getSuperAdminDashboard
);
SuperAdminRouting.post(
  "/create-admin",
  AuthMiddleware(["superadmin"]),
  upload.single("profileImage"),
  CreateAdmin
);
SuperAdminRouting.get(
  "/getall-admin",
  AuthMiddleware(["superadmin"]),
  getAllAdmin
);
SuperAdminRouting.put(
  "/updated-admin/:id",
  AuthMiddleware(["superadmin"]),
  UpdatedAdmin
);
SuperAdminRouting.delete(
  "/delete-admin/:id",
  AuthMiddleware(["superadmin"]),
  DeleteAdmin
);
SuperAdminRouting.put(
  "/toggle-block-admin/:id",
  AuthMiddleware(["superadmin"]),
  toggleBlockAdmin
);
SuperAdminRouting.get(
  "/admin-details/:id",
  AuthMiddleware(["superadmin"]),
  getAdminDetails
);
SuperAdminRouting.get(
  "/payments",
  AuthMiddleware(["superadmin"]),
  getAllPayments
);
SuperAdminRouting.get(
  "/payments/doctor/:doctorId",
  AuthMiddleware(["superadmin"]),
  getPaymentsByDoctor
);
SuperAdminRouting.get(
  "/analytics",
  AuthMiddleware(["superadmin"]),
  getComprehensiveAnalytics
);

// Send a message
// All roles can send, but permission checked in controller
SuperAdminRouting.post(
  "/send",
  AuthMiddleware(["superAdmin", "admin", "doctor", "receptionist", "patient"]),
  sendMessage
);

// Get conversation with another user
SuperAdminRouting.get(
  "/conversation/:userId",
  AuthMiddleware(["superAdmin", "admin", "doctor", "receptionist", "patient"]),
  getConversation
);

export default SuperAdminRouting;
