import express from "express";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import {
  CreateDoctor,
  DeleteDoctors,
  getAllDoctors,
  getDoctorsByDepartment,
  UpdatedAdmin,
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
  cancelAppointment,
  deleteAppointment,
  getAllAppointmentsDetails,
} from "../../Controllers/Admin/AllAppointmentsDetails.js";
import {
  deletePatient,
  getAllPatients,
  getPatientById,
} from "../../Controllers/Admin/GetAllPatients.js";
import {
  createDepartment,
  deleteDepartment,
  getDepartmentById,
  getDepartments,
  updateDepartment,
  updateDepartmentImage,
} from "../../Controllers/Admin/Departmenst.js";
import {
  createSchedule,
  getDoctorAvailableDates,
  updateSchedule,
} from "../../Controllers/Doctor/DoctorSchedules.js";
import { uploadToCloudinary } from "../../Units/uploadToCloudinary.js";
import { upload } from "../../Config/multer.js";
import { archiveMedicalRecord } from "../../Controllers/patient/MedicalHhistory.js";
import { bookAppointment } from "../../Controllers/Receptionist/CreatingAppointments.js";
import { getConversation, sendMessage } from "../../Controllers/Messages/messages.js";
import { Login, Logout } from "../../Controllers/Auth/Units/AuthControllers.js";

const AdminRouting = express.Router();

{
  /* Admin Login */
}
AdminRouting.post("/admin", LoginValidation, Login);
AdminRouting.post("/admin-logout", Logout);

{
  /* Doctoer */
}

AdminRouting.post(
  "/create-Doctor",
  AuthMiddleware(["admin"]),
  upload.single("profileImage"),
  CreateDoctor
);
AdminRouting.get(
  "/getAll-Doctor",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getAllDoctors
);
AdminRouting.get(
  "/getalldoctorDepartments/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDoctorsByDepartment
);
AdminRouting.put("/update-Doctor/:id", AuthMiddleware(["admin"]),upload.single("profileImage"), UpdatedAdmin);

AdminRouting.post(
  "/schedule",
  AuthMiddleware(["doctor", "admin"]),
  createSchedule
);
AdminRouting.delete(
  "/delete-Doctor/:id",
  AuthMiddleware(["admin"]),
  DeleteDoctors
);
AdminRouting.put(
  "/updateschedule/:id",
  AuthMiddleware(["admin"]),
  updateSchedule
);
AdminRouting.get("/schedules/available-dates/:id", AuthMiddleware(["patient","admin"]), getDoctorAvailableDates);

{
  /* Receptnist */
}
AdminRouting.post(
  "/create-Receptionist",
  AuthMiddleware(["admin"]),
  CreateReceptionists
);
AdminRouting.get(
  "/getAll-Receptionist",
  AuthMiddleware(["admin"]),
  getAllReceptionists
);
AdminRouting.get(
  "/getAll-Receptionist/:id",
  AuthMiddleware(["admin", "receptionist"]),
  getReceptionistById
);
AdminRouting.put(
  "/updated-Receptionist/:id",
  AuthMiddleware(["admin"]),
  UpdateReceptionist
);
AdminRouting.delete(
  "/deleted-Receptionist/:id",
  AuthMiddleware(["admin"]),
  DeleteReceptionist
);

{
  /* patients */
}
AdminRouting.get(
  "/getAll-patients",
  AuthMiddleware(["admin", "receptionist"]),
  getAllPatients
);
AdminRouting.get(
  "/getAllpatients/:id",
  AuthMiddleware(["admin"]),
  getPatientById
);
AdminRouting.delete(
  "/deletePatients/:id",
  AuthMiddleware(["admin"]),
  deletePatient
);

{
  /* Appointments */
}
AdminRouting.get(
  "/allAppointments",
  AuthMiddleware(["admin"]),
  getAllAppointmentsDetails
);
AdminRouting.delete(
  "/deleteAppointments/:id",
  AuthMiddleware(["admin"]),
  deleteAppointment
);

AdminRouting.put(
  "/cancelappointments/:id",
  AuthMiddleware(["admin"]),
  cancelAppointment
);
AdminRouting.post("/book",AuthMiddleware(["receptionist","admin"]),bookAppointment)



{
  /* departments */
}
AdminRouting.post(
  "/departments",
  AuthMiddleware(["admin"]),
  upload.single("image"),
  createDepartment
);

// 🟢 Get All Departments (Admin, Receptionist, Patient)
AdminRouting.get(
  "/getdepartmenst",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDepartments
);

// 🟢 Get Department by ID (Admin, Receptionist)
AdminRouting.get(
  "/getdepartmenst/:id",
  AuthMiddleware(["admin", "receptionist","patient"]),
  getDepartmentById
);

// 🟢 Update Department (Admin only)
AdminRouting.put(
  "/updateddepartments/:id",
  AuthMiddleware(["admin"]),
  upload.single("image"), // allow image update
  updateDepartment
);
// updated image

AdminRouting.put(
  "/updatedImage/:id",
  AuthMiddleware(["admin"]),
  upload.single("image"), // allow image update
  updateDepartmentImage
);

// 🟢 Delete Department (Admin only)
AdminRouting.delete(
  "/deleteupdated/:id",
  AuthMiddleware(["admin"]),
  deleteDepartment
);

// Medical record
AdminRouting.delete(
  "/deleteRecord",
  AuthMiddleware(["doctor", "admin"]),
  archiveMedicalRecord
);




// Send a message
// All roles can send, but permission checked in controller
AdminRouting.post("/send", AuthMiddleware(["superAdmin","admin","doctor","receptionist","patient"]), sendMessage);

// Get conversation with another user
AdminRouting.get("/conversation/:userId", AuthMiddleware(["superAdmin","admin","doctor","receptionist","patient"]), getConversation);


export default AdminRouting;
