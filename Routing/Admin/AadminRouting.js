import express from "express";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import {
  CreateDoctor,
  DeleteDoctors,
  getAdminDoctorActivity,
  getAdminDoctorAttendance,
  getAdminDoctorLeaves,
  getAdminDoctorPatients,
  getAdminDoctorPayments,
  getAllDoctors,
  getDoctorAttendance,
  getDoctorById,
  getDoctorOverview,
  getDoctorsByDepartment,
  updateDoctor,
} from "../../Controllers/Admin/DoctorsControllers.js";
import {
  CreateReceptionists,
  DeleteReceptionist,
  getAllReceptionists,
  getReceptionistById,
  UpdateReceptionist,
} from "../../Controllers/Admin/StaffControllers.js";
import { LoginValidation } from "../../Middleware/AuthValidaction.js";

import {
  createDepartment,
  deleteDepartment,
  getDepartmentById,
  getDepartments,
  updateDepartment,
} from "../../Controllers/Admin/Departmenst.js";

import { upload } from "../../Config/multer.js";
import {
  getMessages,
  sendMessage,
} from "../../Controllers/Messages/messages.js";
import { Login, Logout } from "../../Controllers/Auth/Units/AuthControllers.js";
import {
  deletePatient,
  getAllPatients,
  getDoctorPatients,
  getPatientById,
  togglePatientStatus,
} from "../../Controllers/Admin/GetAllPatients.js";
import {
  getAllAppointmentsDetails,
  getLatestAppointments,
  updateAppointmentStatus,
} from "../../Controllers/Admin/AllAppointmentsDetails.js";
import {
  getAdminAnalytics,
  getAdminDashboardCounts,
  getAdminOverview,
  getPatientGenderStats,
  getPatientMonthlyStats,
  getPendingAppointments,
  getTodayAvailableDoctors,
} from "../../Controllers/Admin/adminDashbaord.js";
import {
  getAllLeaveRequests,
  getDoctorLeaves,
} from "../../Controllers/Doctor/LeaveRequest.js";
import { toggleUserStatus } from "../../Controllers/Admin/toggleUsers.js";

const AdminRouting = express.Router();

{
  /* Admin Login */
}
AdminRouting.post("/admin", LoginValidation, Login);
AdminRouting.post("/admin-logout", Logout);

// Dashboard
AdminRouting.get(
  "/dashboard-counts",
  AuthMiddleware(["admin", "superadmin"]),
  getAdminDashboardCounts,
);

AdminRouting.get(
  "/pending-appointments",
  AuthMiddleware(["admin", "superadmin"]),
  getPendingAppointments,
);
AdminRouting.get(
  "/patient-monthly-stats",
  AuthMiddleware(["admin", "superadmin"]),
  getPatientMonthlyStats,
);
AdminRouting.get(
  "/patient-gender-stats",
  AuthMiddleware(["admin", "superadmin"]),
  getPatientGenderStats,
);
AdminRouting.get(
  "/today-doctors",
  AuthMiddleware(["admin", "superadmin"]),
  getTodayAvailableDoctors,
);

{
  /* Doctoer */
}

AdminRouting.post(
  "/create-Doctor",
  AuthMiddleware(["admin"]),
  upload.single("profileImage"),
  CreateDoctor,
);
AdminRouting.get(
  "/getAll-Doctor",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getAllDoctors,
);
AdminRouting.get(
  "/getAll-Doctor/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDoctorById,
);

// Doctor profile dashboard tabs (admin)
AdminRouting.get(
  "/doctors/:id/dashboard/overview",
  AuthMiddleware(["admin", "superadmin"]),
  getDoctorOverview,
);
AdminRouting.get(
  "/doctors/:id/dashboard/patients",
  AuthMiddleware(["admin", "superadmin"]),
  getAdminDoctorPatients,
);
AdminRouting.get(
  "/doctors/:id/dashboard/attendance",
  AuthMiddleware(["admin", "superadmin"]),
  getAdminDoctorAttendance,
);
AdminRouting.get(
  "/doctors/:id/dashboard/leaves",
  AuthMiddleware(["admin", "superadmin"]),
  getAdminDoctorLeaves,
);
AdminRouting.get(
  "/doctors/:id/leaves",
  AuthMiddleware(["admin", "superadmin"]),
  getDoctorLeaves,
);
AdminRouting.get(
  "/doctors/:id/dashboard/payments",
  AuthMiddleware(["admin", "superadmin"]),
  getAdminDoctorPayments,
);
AdminRouting.get(
  "/doctors/:id/dashboard/activity",
  AuthMiddleware(["admin", "superadmin"]),
  getAdminDoctorActivity,
);

AdminRouting.get(
  "/getalldoctorDepartments/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDoctorsByDepartment,
);
AdminRouting.get(
  "/doctors/:id/attendance",
  AuthMiddleware(["admin"]),
  getDoctorAttendance,
);
AdminRouting.put(
  "/update-Doctor/:id",
  AuthMiddleware(["admin"]),
  upload.single("profileImage"),
  updateDoctor,
);

AdminRouting.delete(
  "/delete-Doctor/:id",
  AuthMiddleware(["admin"]),
  DeleteDoctors,
);

{
  /* Receptnist */
}
AdminRouting.post(
  "/create-Receptionist",
  AuthMiddleware(["admin"]),
  CreateReceptionists,
);
AdminRouting.get(
  "/getAll-Receptionist",
  AuthMiddleware(["admin"]),
  getAllReceptionists,
);
AdminRouting.get(
  "/getAll-Receptionist/:id",
  AuthMiddleware(["admin", "receptionist"]),
  getReceptionistById,
);
AdminRouting.put(
  "/updated-Receptionist/:id",
  AuthMiddleware(["admin"]),
  UpdateReceptionist,
);
AdminRouting.delete(
  "/deleted-Receptionist/:id",
  AuthMiddleware(["admin"]),
  DeleteReceptionist,
);

{
  /* patients */
}
AdminRouting.get("/getall-patients", AuthMiddleware(["admin"]), getAllPatients);
AdminRouting.get("/getpatients/:id", AuthMiddleware(["admin"]), getPatientById);
AdminRouting.put(
  "/togel-patients/:id",
  AuthMiddleware(["admin"]),
  togglePatientStatus,
);
AdminRouting.get(
  "/doctors/:id/patients",
  AuthMiddleware(["admin"]),
  getDoctorPatients,
);

AdminRouting.delete(
  "/delete-patients/:id",
  AuthMiddleware(["admin"]),
  deletePatient,
);

{
  /* Appointments */
}
AdminRouting.get(
  "/allappointments",
  AuthMiddleware(["admin"]),
  getAllAppointmentsDetails,
);
AdminRouting.get(
  "/getlatest",
  AuthMiddleware(["admin"]),
  getLatestAppointments,
);
AdminRouting.put(
  "/updateAppointment/:id",
  AuthMiddleware(["admin"]),
  updateAppointmentStatus,
);

{
  /* departments */
}
AdminRouting.post(
  "/departments",
  AuthMiddleware(["admin"]),
  upload.single("image"),
  createDepartment,
);
AdminRouting.get(
  "/getdepartmenst",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDepartments,
);
AdminRouting.get(
  "/getdepartmenst/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDepartmentById,
);
AdminRouting.put(
  "/updateddepartments/:id",
  AuthMiddleware(["admin"]),
  upload.single("image"), // allow image update
  updateDepartment,
);

AdminRouting.delete(
  "/deleteupdated/:id",
  AuthMiddleware(["admin"]),
  deleteDepartment,
);

// TogelUseres
AdminRouting.patch(
  "/toggle/:userId",
  AuthMiddleware(["admin"]),
  toggleUserStatus,
);

// OverView
AdminRouting.get("/overView", AuthMiddleware(["admin"]), getAdminOverview);
AdminRouting.get(
  "/adminAnalytics",
  AuthMiddleware(["admin"]),
  getAdminAnalytics,
);

// leave Reqeust

AdminRouting.get(
  "/leave-requests",
  AuthMiddleware(["admin"]),
  getAllLeaveRequests,
);
// Send a message
AdminRouting.post(
  "/send",
  AuthMiddleware(["superAdmin", "admin", "doctor", "receptionist", "patient"]),
  sendMessage,
);
AdminRouting.get(
  "/conversation/:userId",
  AuthMiddleware(["superAdmin", "admin", "doctor", "receptionist", "patient"]),
  getMessages,
);

export default AdminRouting;
