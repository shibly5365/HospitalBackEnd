import express from "express";
import { Login, Logout, SignUp } from "../../Controllers/Auth/AuthControllers.js";
import { LoginValidation, SignUpValidation } from "../../Middleware/AuthValidaction.js";
import { AuthMiddleware } from "../../Middleware/AuthMiddleware.js";
import { getReceptionistDashboard } from "../../Controllers/Receptionist/resceptonistSummery.js";
import { getDepartmentById, getDepartments } from "../../Controllers/Admin/Departmenst.js";
import { getAllDoctors, getDoctorsByDepartment } from "../../Controllers/Admin/DoctorsControllers.js";
import { getDoctorAvailableDates, getDoctorSchedules } from "../../Controllers/Doctor/DoctorSchedules.js";
import { bookAppointment, receptionistBookAppointment } from "../../Controllers/Receptionist/CreatingAppointments.js";
import { getAllPatients } from "../../Controllers/Admin/GetAllPatients.js";
import { getConversation, sendMessage } from "../../Controllers/Messages/messages.js";
const ReceptionistRouting = express.Router();

ReceptionistRouting.post(
  "/receptionist-login",
  LoginValidation,
  Login
);
ReceptionistRouting.post("/signup", SignUpValidation,AuthMiddleware(["receptionist"]), SignUp);
ReceptionistRouting.post("/receptionist-logout", Logout);


// Dashbaord Summery 
ReceptionistRouting.get("/dashboard",AuthMiddleware(["receptionist"]),getReceptionistDashboard)

// Free slot
ReceptionistRouting.get("/getschedule/:id", AuthMiddleware(["doctor","patient","receptionist"]), getDoctorSchedules)

// all doctorer
ReceptionistRouting.get("/doctors", AuthMiddleware(["admin", "receptionist", "patient"]), getAllDoctors);
ReceptionistRouting.get("/schedules/available-dates/:id", AuthMiddleware(["patient","admin","receptionist"]), getDoctorAvailableDates)


// Departmetns
ReceptionistRouting.get("/getdepartmenst",AuthMiddleware(["admin","receptionist","patient"]),getDepartments)
ReceptionistRouting.get("/getdepartmenst/:id",AuthMiddleware(["admin","receptionist"]),getDepartmentById)
ReceptionistRouting.get("/getalldoctorDepartments/:id",AuthMiddleware(["admin","receptionist","patient"]),getDoctorsByDepartment)

// Patietns 
ReceptionistRouting.get("/getAll-patients",AuthMiddleware(["admin","receptionist"]),getAllPatients)

// appointmentes 
ReceptionistRouting.post("/creating",AuthMiddleware(["receptionist"]),receptionistBookAppointment)
ReceptionistRouting.post("/book",AuthMiddleware(["receptionist","admin"]),bookAppointment)

// Send a message
// All roles can send, but permission checked in controller
ReceptionistRouting.post("/send", AuthMiddleware(["superAdmin","admin","doctor","receptionist","patient"]), sendMessage);

// Get conversation with another user
ReceptionistRouting.get("/conversation/:userId", AuthMiddleware(["superAdmin","admin","doctor","receptionist","patient"]), getConversation);
export default ReceptionistRouting;
