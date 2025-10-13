import express from "express";
import connectDB from "./Config/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import routing from "./Routing/auth/AuthRotuing.js";
import PatientRouting from "./Routing/Patient/Patient.js";
import SuperAdminRouting from "./Routing/SuperAdmin/SuperAdminRouting.js";
import AdminRouting from "./Routing/Admin/AadminRouting.js";
import DoctorRouting from "./Routing/Doctor/DoctorRouiting.js";
import ReceptionistRouting from "./Routing/Receptionist/ReceptionistRouting.js";

dotenv.config();

const app = express();

//ORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//  API routes
app.use("/api/auth", routing);
app.use("/api/patient", PatientRouting);
app.use("/api/superadmin", SuperAdminRouting);
app.use("/api/admin", AdminRouting);
app.use("/api/doctor", DoctorRouting);
app.use("/api/receptionist", ReceptionistRouting);

//  Connect to MongoDB
connectDB();

//  Start server
const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
