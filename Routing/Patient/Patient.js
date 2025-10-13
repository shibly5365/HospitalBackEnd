import express from "express";

import { Login, Logout, SignUp } from "../../Controllers/Auth/AuthControllers.js";
import { LoginValidation, SignUpValidation } from "../../Middleware/AuthValidaction.js";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";

import {
  createPatientAppointment,
  cancelAppointment,
  getMyAppointments,
  rescheduleAppointment,
  getAppointmentById,
  getAvailableSlots,
  deletePatientAppointment,
} from "../../Controllers/patient/Appointments.js";
import { validateAppointment } from "../../Middleware/Appointment/appointmetnVallidetion.js";

import { getPatientDashboardSummary } from "../../Controllers/patient/PatientDashboardSummary.js";
import { getDoctorAvailableDates, getDoctorSchedules, getSchedulesByDoctorId } from "../../Controllers/Doctor/DoctorSchedules.js";
import { getAllDoctors, getDoctorsByDepartment } from "../../Controllers/Admin/DoctorsControllers.js";
import { getDepartmentById, getDepartments } from "../../Controllers/Admin/Departmenst.js";
import { getMyMedicalHistory, getMyMedicalHistoryByDoctor } from "../../Controllers/patient/MedicalHhistory.js";
import { getConversation, sendMessage } from "../../Controllers/Messages/messages.js";

const PatientRouting = express.Router();

/* 🔑 Auth Routes */
PatientRouting.post("/signup", SignUpValidation, SignUp);
PatientRouting.post("/login", LoginValidation, Login);
PatientRouting.post("/logout", Logout);

/* 🩺 Appointment Routes */

// Create new appointment
PatientRouting.post(
  "/appointments",
  AuthMiddleware(["patient"]),
  validateAppointment,
  createPatientAppointment
);

// Get all my appointments
PatientRouting.get("/getAllappointments", AuthMiddleware(["patient"]), getMyAppointments);

// Get appointment by ID
PatientRouting.get("/appointments/:id", AuthMiddleware(["patient"]), getAppointmentById);

// Cancel appointment
PatientRouting.put("/cancelappointments/:id", AuthMiddleware(["patient"]), cancelAppointment);

// Reschedule appointment
PatientRouting.put("/rescheduleappointments/:id", AuthMiddleware(["patient"]), rescheduleAppointment);

// Get available slots for a doctor
PatientRouting.get("/appointments/available-slots/:id", AuthMiddleware(["patient",]), getAvailableSlots);
// delete appointemsn
PatientRouting.delete("/appointmentsdeletes/:id", AuthMiddleware(["patient"]), deletePatientAppointment);

/* 📅 Doctor Schedules */


// Get schedules by doctor ID (any user)
PatientRouting.get("/scheduleDoctor/:id", AuthMiddleware(["admin", "patient", "receptionist"]), getSchedulesByDoctorId);

// Get available dates for a doctor
PatientRouting.get("/schedules/available-dates/:id", AuthMiddleware(["patient","admin","receptionist"]), getDoctorAvailableDates);

/* 📊 Dashboard */
PatientRouting.get("/dashboard-summary", AuthMiddleware(["patient"]), getPatientDashboardSummary);

/* 🏥 Doctors */

// Get all doctors
PatientRouting.get("/doctors", AuthMiddleware(["admin", "receptionist", "patient"]), getAllDoctors);

// Get doctors by department
PatientRouting.get("/getalldoctorDepartments/:id", AuthMiddleware(["admin", "receptionist", "patient"]), getDoctorsByDepartment);

// Get all departments
PatientRouting.get("/getdepartmenst", AuthMiddleware(["admin", "receptionist", "patient"]), getDepartments);
PatientRouting.get("/getdepartmenst/id", AuthMiddleware(["admin", "receptionist", "patient"]), getDepartmentById);

/* 📖 Medical History */

// Get my medical history
PatientRouting.get("/history/me", AuthMiddleware(["patient"]), getMyMedicalHistory);

// Get my medical history by doctor
PatientRouting.get("/history/me/doctor/:doctorId", AuthMiddleware(["patient"]), getMyMedicalHistoryByDoctor);



// Send a message
// All roles can send, but permission checked in controller
PatientRouting.post("/send", AuthMiddleware(["superAdmin","admin","doctor","receptionist","patient"]), sendMessage);

// Get conversation with another user
PatientRouting.get("/conversation/:userId", AuthMiddleware(["superAdmin","admin","doctor","receptionist","patient"]), getConversation);


export default PatientRouting;
