import jwt from "jsonwebtoken";
import userModel from "../Models/User/UserModels.js";

export const AuthMiddleware = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      let token;

      // 1️⃣ Authorization header
      if (req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
      }

      // 2️⃣ Cookie token (if cookie-parser is used)
      else if (req.cookies?.token) {
        token = req.cookies.token;
      }

      if (!token) {
        return res.status(401).json({ message: "Token not provided" });
      }

      // 3️⃣ Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4️⃣ Find user
      const user = await userModel.findById(decoded._id);
      // 5️⃣ Role-based access
      if (
        allowedRoles.length &&
        !allowedRoles
          .map((r) => r.toLowerCase())
          .includes(decoded.role.toLowerCase())
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      // 6️⃣ Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error("Auth Middleware Error:", error.message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
};
