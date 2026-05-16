import express from "express";
import { LoginValidation } from "../../Middleware/AuthValidaction.js";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import { Login, Logout } from "../../Controllers/Auth/Units/AuthControllers.js";
import {
  createNextVisitAppointment,
  endConsultation,
  getAllAppointments,
  getAppointmentById,
  getTodaysAppointments,
  getTodaysNextAppointment,
  rescheduleByDoctor,
  startConsultation,
  updateAppointmentStatus,
} from "../../Controllers/Doctor/DoctorAppointmens.js";
import {
  createSchedule,
  deleteSchedule,
  doctorWorkingDays,
  getDoctorAvailability,
  getDoctorSchedules,
  updateSchedule,
} from "../../Controllers/Doctor/DoctorSchedules.js";
import {
  getDoctorAppointmentHistory,
  getDoctorAppointments,
} from "../../Controllers/patient/Appointments.js";
import {
  getAllConsultations,
  getConsultationById,
} from "../../Controllers/Doctor/Consuletion.js";
import {
  createPrescription,
  deletePrescription,
  doctorGetAllPrescriptions,
  doctorGetPrescriptionById,
  updatePrescription,
} from "../../Controllers/Doctor/Prescription.js";
import {
  createMedicalRecord,
  deleteMedicalRecord,
  doctorGetAllMedicalRecords,
  doctorGetMedicalRecordById,
  updateMedicalRecord,
} from "../../Controllers/Doctor/MedicalRecord.js";
import {
  createPatientByDoctor,
  getDoctorAllPatients,
  getPatientById,
} from "../../Controllers/Doctor/getAllPatients.js";
import {
  getDashboardSummary,
  getDoctorDashboard,
} from "../../Controllers/Doctor/DoctorDashboardStatus.js";
import { createLeaveRequest } from "../../Controllers/Doctor/LeaveRequest.js";

// import { expression } from "joi";
import {
  getMessages,
  getOrCreateConversation,
  sendMessage,
} from "../../Controllers/Messages/messages.js";
import {
  getAllDoctorPayments,
  getDoctorStats,
  getPaymentById,
  getPaymentMethods,
  getWeeklyRevenue,
  refundPayment,
} from "../../Controllers/Doctor/payments.js";
import { getDoctorAnalyticsDashboard } from "../../Controllers/Doctor/doctorAnalyticsController.js";
import { endVideoCall, joinVideoCall } from "../../Controllers/Messages/videoCallController.js";
import rateLimiterService from "../../Units/rateLimiterService.js";
import { asyncHandler } from "../../Units/asyncHandler.js";

const DoctorRouting = express.Router();

// Rate limiting middleware for auth endpoints
const checkAuthLimit = asyncHandler(async (req, res, next) => {
  const email = req.body.email;
  if (email) {
    await rateLimiterService.checkAuthLimit(email);
  }
  next();
});

// Auth
DoctorRouting.post("/login", checkAuthLimit, LoginValidation, Login);
DoctorRouting.post("/logout", AuthMiddleware(["doctor"]), Logout);

// Dashboard
DoctorRouting.get("/summary", AuthMiddleware(["doctor"]), getDashboardSummary);
DoctorRouting.get(
  "/doctorDashbaord",
  AuthMiddleware(["doctor"]),
  getDoctorDashboard,
);
DoctorRouting.get(
  "/doctors-working-day",
  AuthMiddleware(["doctor"]),
  doctorWorkingDays,
);

// Appointment
DoctorRouting.get(
  "/allAppointment",
  AuthMiddleware(["doctor"]),
  getAllAppointments,
);
DoctorRouting.get(
  "/todyaAppointmen",
  AuthMiddleware(["doctor"]),
  getTodaysAppointments,
);
DoctorRouting.get(
  "/history",
  AuthMiddleware(["doctor"]),
  getDoctorAppointmentHistory,
);
DoctorRouting.post(
  "/createNextappoint",
  AuthMiddleware(["doctor"]),
  createNextVisitAppointment,
);

DoctorRouting.get(
  "/nextAppointment",
  AuthMiddleware(["doctor"]),
  getTodaysNextAppointment,
);
DoctorRouting.post(
  "/nextAppointment",
  AuthMiddleware(["doctor"]),
  createNextVisitAppointment,
);

DoctorRouting.get("/app/:id", AuthMiddleware(["doctor"]), getAppointmentById);
DoctorRouting.get(
  "/appointment/:id",
  AuthMiddleware(["doctor"]),
  getAppointmentById,
);
DoctorRouting.put(
  "/statusAppo/:id",
  AuthMiddleware(["doctor"]),
  updateAppointmentStatus,
);
DoctorRouting.put(
  "/reschedule",
  AuthMiddleware(["doctor"]),
  rescheduleByDoctor,
);

// Doctor Schedule
DoctorRouting.post(
  "/createSchedule",
  AuthMiddleware(["doctor"]),
  createSchedule,
);
DoctorRouting.get(
  "/getSchedule",
  AuthMiddleware(["doctor"]),
  getDoctorSchedules,
);
DoctorRouting.put(
  "/updateSchedule",
  AuthMiddleware(["doctor"]),
  updateSchedule,
);
DoctorRouting.delete(
  "/deleteSchedule/:id",
  AuthMiddleware(["doctor"]),
  deleteSchedule,
);

// Consuletion

DoctorRouting.post("/start", AuthMiddleware(["doctor"]), startConsultation);
DoctorRouting.post("/end", AuthMiddleware(["doctor"]), endConsultation);
DoctorRouting.get("/getall", AuthMiddleware(["doctor"]), getAllConsultations);
DoctorRouting.get("/get/:id", AuthMiddleware(["doctor"]), getConsultationById);

// Creating Priscripton

DoctorRouting.post(
  "/creatingPres",
  AuthMiddleware(["doctor"]),
  createPrescription,
);
DoctorRouting.get(
  "/getPres",
  AuthMiddleware(["doctor"]),
  doctorGetAllPrescriptions,
);
DoctorRouting.get(
  "/getPres/:id",
  AuthMiddleware(["doctor"]),
  doctorGetPrescriptionById,
);
DoctorRouting.put(
  "/updatedPres/:id",
  AuthMiddleware(["doctor"]),
  updatePrescription,
);
DoctorRouting.delete(
  "/deletePres",
  AuthMiddleware(["doctor"]),
  deletePrescription,
);

// Medical Record
DoctorRouting.post(
  "/medi-Creating",
  AuthMiddleware(["doctor"]),
  createMedicalRecord,
);
DoctorRouting.get(
  "/medi-get",
  AuthMiddleware(["doctor"]),
  doctorGetAllMedicalRecords,
);
DoctorRouting.get(
  "/medi-get/:id",
  AuthMiddleware(["doctor"]),
  doctorGetMedicalRecordById,
);
DoctorRouting.put(
  "/medi-update",
  AuthMiddleware(["doctor"]),
  updateMedicalRecord,
);
DoctorRouting.delete(
  "/medi-delete",
  AuthMiddleware(["doctor"]),
  deleteMedicalRecord,
);

// Patients

DoctorRouting.post(
  "/createPatintes",
  AuthMiddleware(["doctor"]),
  createPatientByDoctor,
);
DoctorRouting.get(
  "/getallPatients",
  AuthMiddleware(["doctor"]),
  getDoctorAllPatients,
);
DoctorRouting.get(
  "/allPatients/:id",
  AuthMiddleware(["doctor"]),
  getPatientById,
);
// availability
DoctorRouting.get(
  "/availability",
  AuthMiddleware(["doctor"]),
  getDoctorAvailability,
);
// Leave Requests
DoctorRouting.post(
  "/leave-request",
  AuthMiddleware(["doctor"]),
  createLeaveRequest,
);

// Payments
DoctorRouting.get("/stats", AuthMiddleware(["doctor"]), getDoctorStats);
DoctorRouting.get(
  "/weekly-revenue",
  AuthMiddleware(["doctor"]),
  getWeeklyRevenue,
);
DoctorRouting.get(
  "/payment-methods",
  AuthMiddleware(["doctor"]),
  getPaymentMethods,
);
DoctorRouting.get(
  "/getallPayments",
  AuthMiddleware(["doctor"]),
  getAllDoctorPayments,
);
DoctorRouting.get(
  "/getallPayments/:id",
  AuthMiddleware(["doctor"]),
  getPaymentById,
);

DoctorRouting.put(
  "/paymentsUpdate/:id/refund",
  AuthMiddleware(["doctor"]),
  refundPayment,
);

DoctorRouting.get(
  "/analytics",
  AuthMiddleware(["doctor"]),
  getDoctorAnalyticsDashboard,
);

// 📹 Video Call Routes (doctor)
DoctorRouting.get(
  "/appointments/:appointmentId/join-call",
  AuthMiddleware(["doctor"]),
  joinVideoCall
);

// 📞 End call (doctor)
DoctorRouting.post(
  "/appointments/end-call",
  AuthMiddleware(["doctor"]),
  endVideoCall
);

// Messages
DoctorRouting.post("/sendMessage", AuthMiddleware(["doctor"]), sendMessage);
DoctorRouting.get(
  "/getMessage/:conversationId",
  AuthMiddleware(["doctor"]),
  getMessages,
);
DoctorRouting.post(
  "/getOrCreateConversation",
  AuthMiddleware(["doctor"]),
  getOrCreateConversation
);



export default DoctorRouting;
