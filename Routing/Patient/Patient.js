import express from "express";

import {
  LoginValidation,
  SignUpValidation,
} from "../../Middleware/AuthValidaction.js";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import { validateAppointment } from "../../Middleware/Appointment/AppointmetnVallidetion.js";

import {
  Login,
  Logout,
  SignUp,
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
import {
  generateVideoCallRoom,
  getVideoCallStatus,
  endVideoCall,
} from "../../Controllers/patient/VideoCall.js";
import { getPatientDashboardSummary } from "../../Controllers/patient/PatientDashboardSummary.js";
import {
  patientDeleteMedicalRecord,
  patientGetAllMedicalRecords,
  patientGetMedicalRecordById,
  patientGetConsultationsByDoctor,
} from "../../Controllers/patient/MedicalHhistory.js";
import { patientGetMyPayments } from "../../Controllers/patient/Payments.js";
import {
  patientGetProfile,
  patientUpdateProfile,
} from "../../Controllers/patient/Profile.js";
import {
  patientGetAllPrescriptions,
  patientGetPrescriptionById,
} from "../../Controllers/patient/Prescriptions.js";
import { getAllDoctors, getDoctorById, getDoctorsByDepartment } from "../../Controllers/Admin/DoctorsControllers.js";
import { getDoctorAvailableDates, getDoctorAvailableSlots } from "../../Controllers/Receptionist/doctorAvailable.js";
import { getDepartmentById, getDepartments } from "../../Controllers/Admin/Departmenst.js";
import { getConversation, sendMessage } from "../../Controllers/Messages/messages.js";

const PatientRouting = express.Router();

/* 🔑 Auth Routes */
PatientRouting.post("/signup", SignUpValidation, SignUp);
PatientRouting.post("/login", LoginValidation, Login);
PatientRouting.post("/logout", Logout);

// Appointments

PatientRouting.post(
  "/create",
  AuthMiddleware(["patient"]),
  validateAppointment,
  patientCreateAppointment
);
PatientRouting.get(
  "/my",
  AuthMiddleware(["patient"]),
  patientGetMyAppointments
);
PatientRouting.get(
  "/today-appointments",
  AuthMiddleware(["patient"]),
  getTodayPatientAppointments
);
PatientRouting.get("/my/:id", AuthMiddleware(["patient"]), getAppointmentById);

PatientRouting.put(
  "/reschedule/:id",
  AuthMiddleware(["patient"]),
  updateAppointment
);
PatientRouting.put(
  "/cancel/:id",
  AuthMiddleware(["patient"]),
  patientCancelAppointment
);
PatientRouting.delete(
  "/delete/:id",
  AuthMiddleware(["patient"]),
  deleteAppointment
);

// 📹 Video Call Routes
PatientRouting.post(
  "/video-call/:appointmentId",
  AuthMiddleware(["patient","doctor"]),
  generateVideoCallRoom
);
PatientRouting.get(
  "/video-call-status/:appointmentId",
  AuthMiddleware(["patient","doctor"]),
  getVideoCallStatus
);
PatientRouting.put(
  "/video-call-end/:appointmentId",
  AuthMiddleware(["patient","doctor"]),
  endVideoCall
);

// Dashboard

PatientRouting.get(
  "/dashboard",
  AuthMiddleware(["patient"]),
  getPatientDashboardSummary
);

// Medical Record
PatientRouting.get(
  "/medicalRecord",
  AuthMiddleware(["patient"]),
  patientGetAllMedicalRecords
);
PatientRouting.get(
  "/medical/:id",
  AuthMiddleware(["patient"]),
  patientGetMedicalRecordById
);
PatientRouting.delete(
  "/dlt/:id",
  AuthMiddleware(["patient"]),
  patientDeleteMedicalRecord
);

// Consultations by Doctor
PatientRouting.get(
  "/consultations",
  AuthMiddleware(["patient"]),
  patientGetConsultationsByDoctor
);

// payment History

PatientRouting.get(
  "/payment",
  AuthMiddleware(["patient"]),
  patientGetMyPayments
);

// profile
PatientRouting.get(
  "/myProfile",
  AuthMiddleware(["patient"]),
  patientGetProfile
);
PatientRouting.put(
  "/updatedProfile/:id",
  AuthMiddleware(["patient"]),
  patientUpdateProfile
);

// priescriiption

PatientRouting.get(
  "/priesc",
  AuthMiddleware(["patient"]),
  patientGetAllPrescriptions
);
PatientRouting.get(
  "/pries/:id",
  AuthMiddleware(["patient"]),
  patientGetPrescriptionById
);

// getDoctors
PatientRouting.get(
  "/getAll-Doctor",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getAllDoctors
);
PatientRouting.get(
  "/getAll-Doctor/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDoctorById
);
PatientRouting.get(
  "/getalldoctorDepartments/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDoctorsByDepartment
);
PatientRouting.get(
  "/doctor/:id/available-dates",
  AuthMiddleware(["receptionist","patient"]),
  getDoctorAvailableDates
);
PatientRouting.get(
  "/doctor/:doctorId/slots",
  AuthMiddleware(["receptionist","patient"]),
  getDoctorAvailableSlots
);

// Departments

PatientRouting.get(
  "/getdepartmenst",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDepartments
);
PatientRouting.get(
  "/getdepartmenst/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDepartmentById
);

// Messgae
PatientRouting.post(
  "/sendMessage",
  AuthMiddleware(["patient"]),
  sendMessage
);
PatientRouting.get(
  "/getMessage",
  AuthMiddleware(["patient"]),
  getConversation
);
export default PatientRouting;
