import jwt from "jsonwebtoken";
import userModel from "../Models/User/UserModels.js";
import tokenService from "../Units/tokenService.js";
import redisService from "../Units/redisService.js";
import logger from "../Config/logger.js";

export const AuthMiddleware = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      let decoded;

      // Step 1: Try new accessToken first (from Authorization header or cookies)
      let accessToken =
        req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.split(" ")[1]
          : req.cookies?.accessToken;

      if (accessToken) {
        try {
          decoded = tokenService.verifyAccessToken(accessToken);
          if (decoded) {
            // Token is valid, attach to request
            const user = await userModel.findById(decoded._id || decoded.userId);
            if (user) {
              req.user = user;

              // Check role-based access
              if (
                allowedRoles.length &&
                !allowedRoles
                  .map((r) => r.toLowerCase())
                  .includes(user.role.toLowerCase())
              ) {
                return res.status(403).json({
                  message: "Access denied",
                  success: false,
                });
              }

              return next();
            }
          }
        } catch (error) {
          // accessToken invalid/expired, try refresh
          logger.debug("Access token validation failed", {
            error: error.message,
          });
        }
      }

      // Step 2: Try old jwtToken for backward compatibility
      const oldToken = req.cookies?.token;
      if (oldToken) {
        try {
          decoded = jwt.verify(oldToken, process.env.JWT_SECRET);

          // Old token is valid
          const user = await userModel.findById(decoded._id);
          if (user) {
            req.user = user;

            // Check role-based access
            if (
              allowedRoles.length &&
              !allowedRoles
                .map((r) => r.toLowerCase())
                .includes(user.role.toLowerCase())
            ) {
              return res.status(403).json({
                message: "Access denied",
                success: false,
              });
            }

            logger.info("Using legacy jwtToken for auth", {
              userId: decoded._id,
            });
            return next();
          }
        } catch (error) {
          logger.debug("Legacy token validation failed", {
            error: error.message,
          });
          // Old token invalid, proceed to refresh attempt
        }
      }

      // Step 3: Try to refresh using refreshToken
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        try {
          decoded = tokenService.verifyRefreshToken(refreshToken);

          if (decoded) {
            // Check if refresh token is still valid in Redis
            const storedToken = await redisService.get(
              `refreshToken:${decoded._id || decoded.userId}`
            );

            if (
              storedToken &&
              storedToken.token === refreshToken
            ) {
              // Generate new tokens
              const userId = decoded._id || decoded.userId;
              const newTokens = tokenService.generateTokens({
                _id: userId,
                email: decoded.email,
                role: decoded.role,
              });

              // Update cookies with new tokens
              const isProduction = process.env.NODE_ENV === "production";
              res.cookie("accessToken", newTokens.accessToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: "Strict",
                maxAge: 15 * 60 * 1000, // 15 minutes
              });

              res.cookie("refreshToken", newTokens.refreshToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: "Strict",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
              });

              // Update Redis with new refresh token
              await redisService.set(
                `refreshToken:${userId}`,
                { token: newTokens.refreshToken },
                7 * 24 * 60 * 60 // 7 days in seconds
              );

              // Fetch user and attach to request
              const user = await userModel.findById(userId);
              if (user) {
                req.user = user;

                // Check role-based access
                if (
                  allowedRoles.length &&
                  !allowedRoles
                    .map((r) => r.toLowerCase())
                    .includes(user.role.toLowerCase())
                ) {
                  return res.status(403).json({
                    message: "Access denied",
                    success: false,
                  });
                }

                logger.info("Token auto-refreshed", { userId });
                return next();
              }
            }
          }
        } catch (error) {
          logger.debug("Refresh token validation failed", {
            error: error.message,
          });
        }
      }

      // No valid token found
      return res.status(401).json({
        message: "Authentication required",
        success: false,
      });
    } catch (error) {
      logger.error("Auth middleware error", { error: error.message });
      return res.status(401).json({
        message: "Invalid token",
        success: false,
      });
    }
  };
};
