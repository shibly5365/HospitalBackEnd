import express from "express";
import connectDB from "./Config/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";

import routing from "./Routing/auth/AuthRotuing.js";
import PatientRouting from "./Routing/Patient/Patient.js";
import SuperAdminRouting from "./Routing/SuperAdmin/SuperAdminRouting.js";
import AdminRouting from "./Routing/Admin/AadminRouting.js";
import DoctorRouting  from "./Routing/Doctor/DoctorRouiting.js"
import ReceptionistRouting from "./Routing/Receptionist/ReceptionistRouting.js";
import { initSocket } from "./Sockets/socketServer.js";

dotenv.config();

const app = express();

//CORS configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: FRONTEND_URL,
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

//  Start server with Socket.IO
const PORT = process.env.PORT || 4002;
const server = http.createServer(app);
initSocket(server);
server.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
