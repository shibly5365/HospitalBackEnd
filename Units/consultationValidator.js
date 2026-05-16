import Appointment from "../Models/Appointment/Appointment.js";
import doctorModel from "../Models/Doctor/DoctorModels.js";

/**
 * Consultation Validator
 * Validates if a patient can message a doctor based on consultation status and time
 * Rules:
 * 1. During consultation (status: "With-Doctor") - Always allowed
 * 2. After consultation (status: "Completed") - Allowed for 48 hours after completion
 * 3. Otherwise - Not allowed
 */

// Cache for recent consultation checks (avoid repeated DB queries)
const consultationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get latest consultation between patient and doctor
 * @param {string} patientId - Patient MongoDB ID
 * @param {string} doctorUserId - Doctor user MongoDB ID
 * @returns {Object} Latest appointment or null
 */
export async function getLatestConsultation(patientId, doctorUserId) {
  try {
    // Try cache first
    const cacheKey = `${patientId}-${doctorUserId}`;
    const cached = consultationCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.consultation;
    }

    // Find doctor profile by user ID
    const doctorProfile = await doctorModel.findOne({
      userId: doctorUserId,
    });

    if (!doctorProfile) {
      return null;
    }

    // Find latest appointment
    const appointment = await Appointment.findOne({
      patient: patientId,
      doctor: doctorProfile._id,
    }).sort({ appointmentDate: -1 });

    // Cache result
    consultationCache.set(cacheKey, {
      consultation: appointment,
      timestamp: Date.now(),
    });

    return appointment;
  } catch (error) {
    console.error("Error fetching latest consultation:", error);
    return null;
  }
}

/**
 * Validate if patient can send message to doctor
 * @param {string} patientId - Patient MongoDB ID
 * @param {string} doctorUserId - Doctor user MongoDB ID
 * @returns {Object} { isValid, reason, remainingTime }
 */
export async function validatePatientDoctorChat(patientId, doctorUserId) {
  try {
    const appointment = await getLatestConsultation(patientId, doctorUserId);

    if (!appointment) {
      return {
        isValid: false,
        reason: "No consultation found. Please book a consultation first.",
        remainingTime: 0,
      };
    }

    const now = new Date();
    const MS_48_HOURS = 48 * 60 * 60 * 1000;

    // ======================================================
    // DURING CONSULTATION
    // ======================================================
    if (appointment.status === "With-Doctor") {
      return {
        isValid: true,
        reason: "Chat allowed during consultation",
        remainingTime: Infinity, // Ongoing
      };
    }

    // ======================================================
    // AFTER CONSULTATION (WITHIN 48 HOURS)
    // ======================================================
    if (appointment.status === "Completed") {
      // Use completedAt if available, otherwise updatedAt
      const completedAt = new Date(
        appointment.completedAt || appointment.updatedAt
      );

      const expiryTime = completedAt.getTime() + MS_48_HOURS;
      const timeRemaining = expiryTime - now.getTime();

      if (timeRemaining > 0) {
        return {
          isValid: true,
          reason: "Chat allowed for 48 hours after consultation",
          remainingTime: timeRemaining,
          expiresAt: new Date(expiryTime),
        };
      }

      // 48 hours expired
      return {
        isValid: false,
        reason: "Chat window expired. It has been more than 48 hours since consultation.",
        remainingTime: 0,
        expiredAt: new Date(expiryTime),
      };
    }

    // ======================================================
    // OTHER STATUSES
    // ======================================================
    return {
      isValid: false,
      reason: `Chat not allowed. Consultation status: ${appointment.status}`,
      remainingTime: 0,
    };
  } catch (error) {
    console.error("Error validating patient-doctor chat:", error);
    return {
      isValid: false,
      reason: "Error validating consultation. Please try again.",
      remainingTime: 0,
      error: error.message,
    };
  }
}

/**
 * Clear cache for a specific consultation (call after appointment status changes)
 * @param {string} patientId
 * @param {string} doctorUserId
 */
export function clearConsultationCache(patientId, doctorUserId) {
  const cacheKey = `${patientId}-${doctorUserId}`;
  consultationCache.delete(cacheKey);
}

/**
 * Clear all cache (useful for testing or manual refresh)
 */
export function clearAllConsultationCache() {
  consultationCache.clear();
}

/**
 * Get remaining time in human readable format
 * @param {number} milliseconds
 * @returns {string}
 */
export function formatRemainingTime(milliseconds) {
  if (milliseconds <= 0) return "Expired";
  if (milliseconds === Infinity) return "Ongoing";

  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor(
    (milliseconds % (1000 * 60 * 60)) / (1000 * 60)
  );

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}
