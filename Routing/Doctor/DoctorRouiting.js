import express from "express";
import { LoginValidation } from "../../Middleware/AuthValidaction.js";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import {
  getDashboardSummary,
  getTodaysSchedule,
} from "../../Controllers/Doctor/DoctorDashboardStatus.js";
import {
  createAppointmentByDoctor,
  getAppointments,
  getDoctorAvailability,
  setNextAppointment,
  updateAppointmentStatus,
} from "../../Controllers/Doctor/DoctorAppointmens.js";
import { getRecentActivity } from "../../Controllers/Doctor/getRecentActivity.js";
import { addPatient, getDoctorAllPatients } from "../../Controllers/Doctor/getAllPatients.js";
import {
  createSchedule,
  deleteSchedule,
  getDoctorAvailableDates,
  getDoctorSchedules,
  getSchedulesByDoctorId,
  updateSchedule,
} from "../../Controllers/Doctor/DoctorSchedules.js";
import {
  archiveMedicalRecord,
  createMedicalRecord,
  getDoctorQueue,
  getMedicalRecordById,
  startConsultation,
  updateMedicalRecord,
} from "../../Controllers/patient/MedicalHhistory.js";
import { getAvailableSlots } from "../../Controllers/patient/Appointments.js";
import { approveLeave, createLeaveRequest, getDoctorLeaves, rejectLeave } from "../../Controllers/Doctor/LeaveRequest.js";
import { getConversation, sendMessage } from "../../Controllers/Messages/messages.js";
import { Login, Logout } from "../../Controllers/Auth/Units/AuthControllers.js";

// import { setSchedule } from "../../Controllers/Doctor/DoctorSchedules.js"

const DoctorRouting = express.Router();

// Auth
DoctorRouting.post("/login", LoginValidation, Login);
DoctorRouting.post("/logout", AuthMiddleware(["doctor"]), Logout);

// ================= APPOINTMENTS =================
DoctorRouting.get("/appointments", AuthMiddleware(["doctor"]), getAppointments);
DoctorRouting.put("/appointments/status", AuthMiddleware(["doctor"]), updateAppointmentStatus);
DoctorRouting.post("/appointments/next", AuthMiddleware(["doctor"]), setNextAppointment);
DoctorRouting.post("/doctor/create-appointment",AuthMiddleware(["doctor"]), createAppointmentByDoctor)


// ================= LEAVE =================
DoctorRouting.post("/leave",AuthMiddleware(["doctor"]),createLeaveRequest)
DoctorRouting.get("/getleave/:doctorId",AuthMiddleware(["doctor"]),getDoctorLeaves)
DoctorRouting.put("/aproveleave",AuthMiddleware(["doctor"]),approveLeave)
DoctorRouting.put("/rejectleave",AuthMiddleware(["doctor"]),rejectLeave)

// ================= DASHBOARD =================
DoctorRouting.get("/dashboard/summary", AuthMiddleware(["doctor"]), getDashboardSummary);
DoctorRouting.get("/dashboard/today-schedule", AuthMiddleware(["doctor"]), getTodaysSchedule);
DoctorRouting.get("/dashboard/recent-activity", AuthMiddleware(["doctor"]), getRecentActivity);


// ================= PATIENTS =================
DoctorRouting.post("/createPatintes", AuthMiddleware(["doctor"]), addPatient)
DoctorRouting.get("/allPatients", AuthMiddleware(["doctor"]), getDoctorAllPatients)


// ================= DOCTOR SCHEDULE =================
// Create schedule (doctor or admin)
DoctorRouting.post("/schedule", AuthMiddleware(["doctor", "admin"]), createSchedule);

// Get all schedules (admin or query by doctorId)
DoctorRouting.get("/getschedule", AuthMiddleware(["doctor", "admin"]), getDoctorSchedules);

// Get schedules by doctor ID (any user)
DoctorRouting.get("/schedule/:id", AuthMiddleware(["admin", "patient", "receptionist","doctor"]), getSchedulesByDoctorId);

// Update schedule by ID (admin only)
DoctorRouting.put("/schedule/update/:scheduleId", AuthMiddleware(["admin","doctor"]), updateSchedule);

// Get doctor available dates (patient)
DoctorRouting.get("/schedule/available/:id", AuthMiddleware(["patient", "doctor"]), getDoctorAvailableDates);
// DoctorRouting.get("/appointments/available-slots", AuthMiddleware(["patient","doctor"]), getAvailableSlots);


DoctorRouting.delete("/schedule/delete/:id",AuthMiddleware(["admin","doctor"]),deleteSchedule)


// ================= MEDICAL RECORD =================
DoctorRouting.post("/createRecords", AuthMiddleware(["doctor"]), createMedicalRecord);
DoctorRouting.get("/history/patient/:id", AuthMiddleware(["doctor"]), getMedicalRecordById);
DoctorRouting.put("/updatedRecords/:id", AuthMiddleware(["doctor"]), updateMedicalRecord);
DoctorRouting.delete("/deleteRecord/:id", AuthMiddleware(["doctor", "admin"]), archiveMedicalRecord);


// ================= CONSULTATION =================
DoctorRouting.get("/consultation", AuthMiddleware(["doctor"]), getDoctorQueue);
DoctorRouting.post("/consultation/start/:appointmentId", AuthMiddleware(["doctor"]), startConsultation);



// Availability
DoctorRouting.get("/availability",AuthMiddleware(["doctor"]), getDoctorAvailability);


// Send a message
// All roles can send, but permission checked in controller
DoctorRouting.post("/send", AuthMiddleware(["superAdmin","admin","doctor","receptionist","patient"]), sendMessage);

// Get conversation with another user
DoctorRouting.get("/conversation/:userId", AuthMiddleware(["superAdmin","admin","doctor","receptionist","patient"]), getConversation);


export default DoctorRouting;
