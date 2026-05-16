// ✅ FIXED VERSION - Secure JWT verification from httpOnly cookies

import jwt from "jsonwebtoken";
import userModel from "../Models/User/UserModels.js";

export const AuthMiddleware = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      let token;

      // ✅ FIX #2: Primary source - httpOnly cookie (secure)
      if (req.cookies?.token) {
        token = req.cookies.token;
      }
      // ✅ Fallback - Authorization header (for API clients, mobile apps)
      else if (req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "No token provided. Please login.",
        });
      }

      // ✅ Verify JWT with strong secret
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        if (err.name === "TokenExpiredError") {
          // ✅ Clear expired cookie
          res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            path: "/",
          });

          return res.status(401).json({
            success: false,
            message: "Token expired. Please login again.",
            code: "TOKEN_EXPIRED",
          });
        }

        throw err;
      }

      // ✅ Find user
      const user = await userModel.findById(decoded._id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // ✅ Check if user is blocked
      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Your account has been blocked",
        });
      }

      // ✅ Role-based access control
      if (
        allowedRoles.length > 0 &&
        !allowedRoles
          .map((r) => r.toLowerCase())
          .includes(decoded.role.toLowerCase())
      ) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Requires role: ${allowedRoles.join(", ")}`,
        });
      }

      // ✅ Attach verified user to request
      req.user = user;
      req.token = token;
      req.decoded = decoded;

      next();
    } catch (error) {
      console.error("Auth Middleware Error:", error.message);
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  };
};

// ✅ Optional middleware to verify only specific roles
export const RoleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This action requires one of: ${roles.join(", ")}`,
      });
    }

    next();
  };
};

// ✅ Optional middleware to refresh token before expiry
export const TokenRefreshMiddleware = (req, res, next) => {
  try {
    if (!req.token || !req.decoded) {
      return next();
    }

    // Check if token will expire soon (within 1 hour)
    const expiresIn = req.decoded.exp * 1000 - Date.now();
    const oneHour = 60 * 60 * 1000;

    if (expiresIn < oneHour && expiresIn > 0) {
      // Generate new token
      const newToken = jwt.sign(
        {
          _id: req.decoded._id,
          email: req.decoded.email,
          role: req.decoded.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES || "7d" }
      );

      const isProduction = process.env.NODE_ENV === "production";

      // Set new cookie
      res.cookie("token", newToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      console.log(`✅ Token refreshed for user ${req.decoded._id}`);
    }

    next();
  } catch (err) {
    console.error("Token refresh error:", err);
    next();  // Continue even if refresh fails
  }
};
