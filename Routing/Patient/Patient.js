import express from "express";

import {
  LoginValidation,
  SignUpValidation,
} from "../../Middleware/AuthValidaction.js";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import { validateAppointment } from "../../Middleware/Appointment/AppointmetnVallidetion.js";

import {
  getMe,
  Login,
  Logout,
  SignUp,
  updateProfile,
  VerifyOtp,
} from "../../Controllers/Auth/Units/AuthControllers.js";
import {
  deleteAppointment,
  getAppointmentById,
  getTodayPatientAppointments,
  patientCancelAppointment,
  patientCreateAppointment,
  patientGetMyAppointments,
  updateAppointment,
} from "../../Controllers/patient/Appointments.js";
import { getPatientDashboardSummary } from "../../Controllers/patient/PatientDashboardSummary.js";
import {
  patientDeleteMedicalRecord,
  patientGetAllMedicalRecords,
  patientGetMedicalRecordById,
  patientGetConsultationsByDoctor,
} from "../../Controllers/patient/MedicalHhistory.js";
import { patientGetMyPayments } from "../../Controllers/patient/Payments.js";

import {
  patientGetAllPrescriptions,
  patientGetPrescriptionById,
} from "../../Controllers/patient/Prescriptions.js";
import {
  getAllDoctors,
  getDoctorById,
  getDoctorsByDepartment,
} from "../../Controllers/Admin/DoctorsControllers.js";
import {
  getDoctorAvailableDates,
  getDoctorAvailableSlots,
} from "../../Controllers/Receptionist/doctorAvailable.js";
import {
  getDepartmentById,
  getDepartments,
} from "../../Controllers/Admin/Departmenst.js";
import {
  getMessages,
  getOrCreateConversation,
  sendMessage,
} from "../../Controllers/Messages/messages.js";
import { upload } from "../../Config/multer.js";
import { changePassword } from "../../Controllers/Auth/ForgetPassword.js";
import {
  endVideoCall,
  joinVideoCall,
} from "../../Controllers/Messages/videoCallController.js";
import rateLimiterService from "../../Units/rateLimiterService.js";
import { asyncHandler } from "../../Units/asyncHandler.js";

const PatientRouting = express.Router();

// Rate limiting middleware for auth endpoints
const checkAuthLimit = asyncHandler(async (req, res, next) => {
  const email = req.body.email;
  if (email) {
    await rateLimiterService.checkAuthLimit(email);
  }
  next();
});

const checkOtpLimit = asyncHandler(async (req, res, next) => {
  const email = req.body.email;
  if (email) {
    await rateLimiterService.checkOtpLimit(email);
  }
  next();
});

/* 🔑 Auth Routes */
PatientRouting.post("/signup", checkAuthLimit, upload.single("profileImage"), SignUp);
PatientRouting.post("/verify-otp", checkOtpLimit, VerifyOtp);
PatientRouting.post("/login", checkAuthLimit, LoginValidation, Login);
PatientRouting.post("/logout", Logout);

PatientRouting.put(
  "/change-password",
  AuthMiddleware(["patient"]),
  changePassword,
);

// Appointments

PatientRouting.post(
  "/create",
  AuthMiddleware(["patient"]),
  validateAppointment,
  patientCreateAppointment,
);
PatientRouting.get(
  "/my",
  AuthMiddleware(["patient"]),
  patientGetMyAppointments,
);
PatientRouting.get(
  "/today-appointments",
  AuthMiddleware(["patient"]),
  getTodayPatientAppointments,
);
PatientRouting.get("/my/:id", AuthMiddleware(["patient"]), getAppointmentById);

PatientRouting.put(
  "/reschedule/:id",
  AuthMiddleware(["patient"]),
  updateAppointment,
);
PatientRouting.put(
  "/cancel/:id",
  AuthMiddleware(["patient"]),
  patientCancelAppointment,
);
PatientRouting.delete(
  "/delete/:id",
  AuthMiddleware(["patient"]),
  deleteAppointment,
);

// 📹 Video Call Routes
PatientRouting.get(
  "/appointments/:appointmentId/join-call",
  AuthMiddleware(["patient"]),
  joinVideoCall,
);

// 📞 End call (patient)
PatientRouting.post(
  "/appointments/end-call",
  AuthMiddleware(["patient"]),
  endVideoCall,
);

// Dashboard

PatientRouting.get(
  "/dashboard",
  AuthMiddleware(["patient"]),
  getPatientDashboardSummary,
);

// Medical Record
PatientRouting.get(
  "/medicalRecord",
  AuthMiddleware(["patient"]),
  patientGetAllMedicalRecords,
);
PatientRouting.get(
  "/medical/:id",
  AuthMiddleware(["patient"]),
  patientGetMedicalRecordById,
);
PatientRouting.delete(
  "/dlt/:id",
  AuthMiddleware(["patient"]),
  patientDeleteMedicalRecord,
);

// Consultations by Doctor
PatientRouting.get(
  "/consultations",
  AuthMiddleware(["patient"]),
  patientGetConsultationsByDoctor,
);

// payment History

PatientRouting.get(
  "/payment",
  AuthMiddleware(["patient"]),
  patientGetMyPayments,
);

// priescriiption

PatientRouting.get(
  "/priesc",
  AuthMiddleware(["patient"]),
  patientGetAllPrescriptions,
);
PatientRouting.get(
  "/pries/:id",
  AuthMiddleware(["patient"]),
  patientGetPrescriptionById,
);

// getDoctors
PatientRouting.get(
  "/getAll-Doctor",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getAllDoctors,
);
PatientRouting.get(
  "/getAll-Doctor/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDoctorById,
);
PatientRouting.get(
  "/getalldoctorDepartments/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDoctorsByDepartment,
);
PatientRouting.get(
  "/doctor/:id/available-dates",
  AuthMiddleware(["receptionist", "patient"]),
  getDoctorAvailableDates,
);
PatientRouting.get(
  "/doctor/:doctorId/slots",
  AuthMiddleware(["receptionist", "patient"]),
  getDoctorAvailableSlots,
);

// Departments

PatientRouting.get(
  "/getdepartmenst",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDepartments,
);
PatientRouting.get(
  "/getdepartmenst/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDepartmentById,
);

// Messgae
PatientRouting.post("/sendMessage", AuthMiddleware(["patient"]), sendMessage);
PatientRouting.get(
  "/getMessage/:conversationId",
  AuthMiddleware(["patient"]),
  getMessages,
);
PatientRouting.post(
  "/getOrCreateConversation",
  AuthMiddleware(["patient"]),
  getOrCreateConversation,
);
export default PatientRouting;
