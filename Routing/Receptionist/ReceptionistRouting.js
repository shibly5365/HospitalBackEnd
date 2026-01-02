import express from "express";
import {
  LoginValidation,
  SignUpValidation,
} from "../../Middleware/AuthValidaction.js";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";

import {
  Login,
  Logout,
  SignUp,
} from "../../Controllers/Auth/Units/AuthControllers.js";
import {
  cancelAppointment,
  createAppointment,
  createAppointmentWithPayment,
  getAllAppointments,
  getAppointmentById,
  getDoctorNextAppointments,
  getTodayAppointments,
  rescheduleAppointment,
  updateAppointment,
  getAppointmentsByDepartment,
  getAppointmentsByDoctor,
} from "../../Controllers/Receptionist/CreatingAppointments.js";
import {
  getReceptionistDashboard,
  getPatientCompleteDetails,
} from "../../Controllers/Receptionist/ReceptionistDashboardController.js";
import {
  getAllPatients,
  getPatientById,
  updatePatient,
  searchPatients,
  registerPatient,
} from "../../Controllers/Receptionist/PatientManagement.js";
import {
  getAllPayments,
  getPendingPayments,
  getCompletedPayments,
  generateBill,
  getPaymentById,
} from "../../Controllers/Receptionist/BillingPayments.js";
import {
  getAllDoctors,
  getDoctorsOnDutyToday,
  getAllDepartments,
  getDoctorTimings,
} from "../../Controllers/Receptionist/DoctorDepartment.js";
import {
  getDailyAppointmentsReport,
  getDailyBillingReport,
  getNewPatientRegistrationsReport,
  getReceptionActivityLog,
} from "../../Controllers/Receptionist/Reports.js";
import {
  checkSlotAvailability,
  doctorAvailableOnDate,
  doctorAvailableOnDay,
  getDoctorAvailableDates,
  getDoctorAvailableSlots,
  getDoctorsAvailableOnDate,
  getDoctorsAvailableToday,
  isDoctorAvailable,
} from "../../Controllers/Receptionist/doctorAvailable.js";

const ReceptionistRouting = express.Router();

// login
ReceptionistRouting.post("/receptionist-login", LoginValidation, Login);
ReceptionistRouting.post(
  "/signup",
  SignUpValidation,
  AuthMiddleware(["receptionist"]),
  SignUp
);
ReceptionistRouting.post("/receptionist-logout", Logout);

// Appointments
ReceptionistRouting.post(
  "/create",
  AuthMiddleware(["receptionist"]),
  createAppointment
);
ReceptionistRouting.post(
  "/book-with-payment",
  AuthMiddleware(["receptionist"]),
  createAppointmentWithPayment
);
ReceptionistRouting.get(
  "/get",
  AuthMiddleware(["receptionist"]),
  getAllAppointments
);
ReceptionistRouting.get(
  "/get/:id",
  AuthMiddleware(["receptionist"]),
  getAppointmentById
);
ReceptionistRouting.put(
  "/udpated/:id",
  AuthMiddleware(["receptionist"]),
  updateAppointment
);
ReceptionistRouting.put(
  "/reschudle/:id",
  AuthMiddleware(["receptionist"]),
  rescheduleAppointment
);
ReceptionistRouting.put(
  "/cancel/:id",
  AuthMiddleware(["receptionist"]),
  cancelAppointment
);
ReceptionistRouting.get(
  "/todayAppoi",
  AuthMiddleware(["receptionist"]),
  getTodayAppointments
);
ReceptionistRouting.get(
  "/nextUpcoming",
  AuthMiddleware(["receptionist"]),
  getDoctorNextAppointments
);
ReceptionistRouting.get(
  "/appointments/by-department",
  AuthMiddleware(["receptionist"]),
  getAppointmentsByDepartment
);
ReceptionistRouting.get(
  "/appointments/by-doctor/:doctorId",
  AuthMiddleware(["receptionist"]),
  getAppointmentsByDoctor
);

// Doctors Availablites

//Check general availability
ReceptionistRouting.get(
  "/doctor/:id/availability",
  AuthMiddleware(["receptionist"]),
  isDoctorAvailable
);

// Check availability on specific day (Monday, Tuesday...)
ReceptionistRouting.get(
  "/doctor/:doctorId/availability/day",
  AuthMiddleware(["receptionist"]),
  doctorAvailableOnDay
);
ReceptionistRouting.get(
  "/doctors/available/today",
  AuthMiddleware(["receptionist"]),
  getDoctorsAvailableToday
);

// Get all doctors available on a specific date
ReceptionistRouting.get(
  "/doctor/available-on-date",
  AuthMiddleware(["receptionist"]),
  getDoctorsAvailableOnDate
);

// Check if a doctor is available on a specific date
ReceptionistRouting.get(
  "/doctor/:id/availability/date",
  AuthMiddleware(["receptionist"]),
  doctorAvailableOnDate
);

// Get all available slots for a doctor on a specific date
ReceptionistRouting.get(
  "/doctor/:doctorId/slots",
  AuthMiddleware(["receptionist"]),
  getDoctorAvailableSlots
);

// Check if a specific slot is available
ReceptionistRouting.get(
  "/doctor/:doctorId/check-slot",
  AuthMiddleware(["receptionist"]),
  checkSlotAvailability
);

// Get all available dates for a doctor
ReceptionistRouting.get(
  "/doctor/:id/available-dates",
  AuthMiddleware(["receptionist", "patient"]),
  getDoctorAvailableDates
);
ReceptionistRouting.get(
  "/doctor/available-dates",
  AuthMiddleware(["receptionist"]),
  getDoctorsAvailableOnDate
);

// Dashboard
ReceptionistRouting.get(
  "/dashboard",
  AuthMiddleware(["receptionist"]),
  getReceptionistDashboard
);

// Patient Details
ReceptionistRouting.get(
  "/patient/:patientId/details",
  AuthMiddleware(["receptionist"]),
  getPatientCompleteDetails
);

// ==================== Patient Management ====================
ReceptionistRouting.post(
  "/patients/register",
  AuthMiddleware(["receptionist"]),
  registerPatient
);
ReceptionistRouting.get(
  "/patients",
  AuthMiddleware(["receptionist"]),
  getAllPatients
);
ReceptionistRouting.get(
  "/patients/search",
  AuthMiddleware(["receptionist"]),
  searchPatients
);
ReceptionistRouting.get(
  "/patients/:patientId",
  AuthMiddleware(["receptionist"]),
  getPatientById
);
ReceptionistRouting.put(
  "/patients/:patientId",
  AuthMiddleware(["receptionist"]),
  updatePatient
);

// ==================== Billing & Payments ====================
ReceptionistRouting.get(
  "/payments",
  AuthMiddleware(["receptionist"]),
  getAllPayments
);
ReceptionistRouting.get(
  "/payments/pending",
  AuthMiddleware(["receptionist"]),
  getPendingPayments
);
ReceptionistRouting.get(
  "/payments/completed",
  AuthMiddleware(["receptionist"]),
  getCompletedPayments
);
ReceptionistRouting.post(
  "/payments/generate-bill",
  AuthMiddleware(["receptionist"]),
  generateBill
);
ReceptionistRouting.get(
  "/payments/:paymentId",
  AuthMiddleware(["receptionist"]),
  getPaymentById
);

// ==================== Doctor & Department ====================
ReceptionistRouting.get(
  "/doctors",
  AuthMiddleware(["receptionist"]),
  getAllDoctors
);
ReceptionistRouting.get(
  "/doctors/on-duty-today",
  AuthMiddleware(["receptionist"]),
  getDoctorsOnDutyToday
);
ReceptionistRouting.get(
  "/doctors/:doctorId/timings",
  AuthMiddleware(["receptionist"]),
  getDoctorTimings
);
ReceptionistRouting.get(
  "/departments",
  AuthMiddleware(["receptionist"]),
  getAllDepartments
);

// ==================== Reports ====================
ReceptionistRouting.get(
  "/reports/appointments",
  AuthMiddleware(["receptionist"]),
  getDailyAppointmentsReport
);
ReceptionistRouting.get(
  "/reports/billing",
  AuthMiddleware(["receptionist"]),
  getDailyBillingReport
);
ReceptionistRouting.get(
  "/reports/patient-registrations",
  AuthMiddleware(["receptionist"]),
  getNewPatientRegistrationsReport
);
ReceptionistRouting.get(
  "/reports/activity-log",
  AuthMiddleware(["receptionist"]),
  getReceptionActivityLog
);

export default ReceptionistRouting;
