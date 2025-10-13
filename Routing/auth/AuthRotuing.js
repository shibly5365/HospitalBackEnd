import express from "express";
import { LoginValidation } from "../../Middleware/AuthValidaction.js";
import { Login, Logout } from "../../Controllers/Auth/AuthControllers.js";
import { ForgetPassword, ResetPassword } from "../../Controllers/Auth/ForgetPassword.js";

const routing = express.Router();

routing.post("/login", LoginValidation, Login);
routing.post("/logout",  Logout);

routing.post("/forgot-password",ForgetPassword)
routing.post("/reset-password",ResetPassword)

export default routing;
