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
  generateVideoCallRoom,
  getVideoCallStatus,
  endVideoCall,
} from "../../Controllers/patient/VideoCall.js";
import {
  createSchedule,
  deleteSchedule,
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
import { getDashboardSummary } from "../../Controllers/Doctor/DoctorDashboardStatus.js";
import { createLeaveRequest } from "../../Controllers/Doctor/LeaveRequest.js";

// import { expression } from "joi";

const DoctorRouting = express.Router();

// Auth
DoctorRouting.post("/login", LoginValidation, Login);
DoctorRouting.post("/logout", AuthMiddleware(["doctor"]), Logout);


// Dashboard 
DoctorRouting.get("/summary",AuthMiddleware(["doctor"]),getDashboardSummary)


// Appointment
DoctorRouting.get(
  "/allAppointment",
  AuthMiddleware(["doctor"]),
  getAllAppointments
);
DoctorRouting.get(
  "/todyaAppointmen",
  AuthMiddleware(["doctor"]),
  getTodaysAppointments
);
DoctorRouting.get(
  "/history",
  AuthMiddleware(["doctor"]),
  getDoctorAppointmentHistory
);
DoctorRouting.post(
  "/createNextappoint",
  AuthMiddleware(["doctor"]),
  createNextVisitAppointment
);


DoctorRouting.get("/nextAppointment",AuthMiddleware(["doctor"]),getTodaysNextAppointment)

DoctorRouting.get("/app/:id", AuthMiddleware(["doctor"]), getAppointmentById);
DoctorRouting.put(
  "/statusAppo",
  AuthMiddleware(["doctor"]),
  updateAppointmentStatus
);
DoctorRouting.put(
  "/reschedule",
  AuthMiddleware(["doctor"]),
  rescheduleByDoctor
);

// Doctor Schedule
DoctorRouting.post(
  "/createSchedule",
  AuthMiddleware(["doctor"]),
  createSchedule
);
DoctorRouting.get(
  "/getSchedule",
  AuthMiddleware(["doctor"]),
  getDoctorSchedules
);
DoctorRouting.put(
  "/updateSchedule",
  AuthMiddleware(["doctor"]),
  updateSchedule
);
DoctorRouting.delete(
  "/deleteSchedule/:id",
  AuthMiddleware(["doctor"]),
  deleteSchedule
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
  createPrescription
);
DoctorRouting.get(
  "/getPres",
  AuthMiddleware(["doctor"]),
  doctorGetAllPrescriptions
);
DoctorRouting.get(
  "/getPres/:id",
  AuthMiddleware(["doctor"]),
  doctorGetPrescriptionById
);
DoctorRouting.put(
  "/updatedPres/:id",
  AuthMiddleware(["doctor"]),
  updatePrescription
);
DoctorRouting.delete(
  "/deletePres",
  AuthMiddleware(["doctor"]),
  deletePrescription
);

// Medical Record
DoctorRouting.post(
  "/medi-Creating",
  AuthMiddleware(["doctor"]),
  createMedicalRecord
);
DoctorRouting.get(
  "/medi-get",
  AuthMiddleware(["doctor"]),
  doctorGetAllMedicalRecords
);
DoctorRouting.get(
  "/medi-get/:id",
  AuthMiddleware(["doctor"]),
  doctorGetMedicalRecordById
);
DoctorRouting.put(
  "/medi-update",
  AuthMiddleware(["doctor"]),
  updateMedicalRecord
);
DoctorRouting.delete(
  "/medi-delete",
  AuthMiddleware(["doctor"]),
  deleteMedicalRecord
);

// Patients

DoctorRouting.post(
  "/createPatintes",
  AuthMiddleware(["doctor"]),
  createPatientByDoctor
);
DoctorRouting.get(
  "/getallPatients",
  AuthMiddleware(["doctor"]),
  getDoctorAllPatients
);
DoctorRouting.get(
  "/allPatients/:id",
  AuthMiddleware(["doctor"]),
  getPatientById
);


// Leave Requests
DoctorRouting.post("/leave-request", AuthMiddleware(["doctor"]), createLeaveRequest);

// 📹 Video Call Routes (doctor)
DoctorRouting.post(
  "/video-call/:appointmentId",
  AuthMiddleware(["doctor"]),
  generateVideoCallRoom
);
DoctorRouting.get(
  "/video-call-status/:appointmentId",
  AuthMiddleware(["doctor"]),
  getVideoCallStatus
);
DoctorRouting.put(
  "/video-call-end/:appointmentId",
  AuthMiddleware(["doctor"]),
  endVideoCall
);

export default DoctorRouting;
