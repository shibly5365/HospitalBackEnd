import express from "express";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import {
  CreateDoctor,
  DeleteDoctors,
  getAllDoctors,
  getDoctorById,
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
  updateDepartmentImage,
} from "../../Controllers/Admin/Departmenst.js";

import { upload } from "../../Config/multer.js";
import {
  getConversation,
  sendMessage,
} from "../../Controllers/Messages/messages.js";
import { Login, Logout } from "../../Controllers/Auth/Units/AuthControllers.js";
import {
  deletePatient,
  getAllPatients,
  getPatientById,
  togglePatientStatus,
} from "../../Controllers/Admin/GetAllPatients.js";

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
  "/getAll-Doctor/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDoctorById
);
AdminRouting.get(
  "/getalldoctorDepartments/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDoctorsByDepartment
);
AdminRouting.put(
  "/update-Doctor/:id",
  AuthMiddleware(["admin"]),
  upload.single("profileImage"),
  updateDoctor
);

AdminRouting.delete(
  "/delete-Doctor/:id",
  AuthMiddleware(["admin"]),
  DeleteDoctors
);

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
AdminRouting.get("/getall-patients", AuthMiddleware(["admin"]), getAllPatients);
AdminRouting.get("/getpatients/:id", AuthMiddleware(["admin"]), getPatientById);
AdminRouting.put(
  "/togel-patients/:id",
  AuthMiddleware(["admin"]),
  togglePatientStatus
);
AdminRouting.delete(
  "/delete-patients/:id",
  AuthMiddleware(["admin"]),
  deletePatient
);

{
  /* Appointments */
}

{
  /* departments */
}
AdminRouting.post(
  "/departments",
  AuthMiddleware(["admin"]),
  upload.single("image"),
  createDepartment
);
AdminRouting.get(
  "/getdepartmenst",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDepartments
);
AdminRouting.get(
  "/getdepartmenst/:id",
  AuthMiddleware(["admin", "receptionist", "patient"]),
  getDepartmentById
);
AdminRouting.put(
  "/updateddepartments/:id",
  AuthMiddleware(["admin"]),
  upload.single("image"), // allow image update
  updateDepartment
);
AdminRouting.put(
  "/updatedImage/:id",
  AuthMiddleware(["admin"]),
  upload.single("image"), // allow image update
  updateDepartmentImage
);
AdminRouting.delete(
  "/deleteupdated/:id",
  AuthMiddleware(["admin"]),
  deleteDepartment
);

// Medical record

// Send a message
AdminRouting.post(
  "/send",
  AuthMiddleware(["superAdmin", "admin", "doctor", "receptionist", "patient"]),
  sendMessage
);
AdminRouting.get(
  "/conversation/:userId",
  AuthMiddleware(["superAdmin", "admin", "doctor", "receptionist", "patient"]),
  getConversation
);

export default AdminRouting;
