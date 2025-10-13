import mongoose from "mongoose";
import Appointment from "../../Models/Appointment/Appointment.js";
import userModel from "../../Models/User/UserModels.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import moment from "moment";

// POST /receptionist/book-appointment

export const receptionistBookAppointment = async (req, res) => {
  try {
    const {
      fullName,
      age,
      gender,
      dob,
      contact,
      email,
      address,
      patientType,
      visitingType, // "Scheduled", "WalkIn", "Online"
      departmentId,
      doctorId,
      appointmentDate, // "YYYY-MM-DD"
      timeSlot, // { start: "10:30", end: "11:00" }
      reason,
      emergencyName,
      emergencyPhone,
      insuranceInfo,
    } = req.body;

    // 🔎 Validate appointmentDate
    if (
      !appointmentDate ||
      !moment(appointmentDate, "YYYY-MM-DD", true).isValid()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing appointmentDate (must be YYYY-MM-DD)",
      });
    }

    // 🔎 Validate timeSlot
    if (!timeSlot || !timeSlot.start || !timeSlot.end) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing timeSlot",
      });
    }

    // 1️⃣ Check if patient exists
    let patient = await userModel.findOne({ $or: [{ email }, { contact }] });
    if (!patient) {
      patient = new userModel({
        fullName,
        age,
        gender,
        dob,
        contact,
        email,
        address,
        role: "patient",
        patientType,
        emergencyContact: {
          name: emergencyName || null,
          number: emergencyPhone || null,
        },
        insuranceInfo: insuranceInfo || null,
      });
      await patient.save();
    }

    // 2️⃣ Find doctor's schedule by exact day
    const targetDateStart = moment
      .utc(appointmentDate, "YYYY-MM-DD")
      .startOf("day")
      .toDate();
    const targetDateEnd = moment
      .utc(appointmentDate, "YYYY-MM-DD")
      .endOf("day")
      .toDate();

    const schedule = await DoctorSchedule.findOne({
      doctor: doctorId,
      date: { $gte: targetDateStart, $lte: targetDateEnd }, // matches same day
    });

    if (!schedule) {
      return res.status(400).json({
        success: false,
        message: "Doctor does not have a schedule for this date",
      });
    }

    // 3️⃣ Validate requested slot exists and is free
    if (!schedule.slots || !Array.isArray(schedule.slots)) {
      return res.status(400).json({
        success: false,
        message: "Doctor schedule has no slots",
      });
    }

    const slotIndex = schedule.slots.findIndex(
      (s) => s.start === timeSlot.start && s.end === timeSlot.end
    );

    if (slotIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Selected slot does not exist in the doctor's schedule",
      });
    }

    if (schedule.slots[slotIndex].isBooked) {
      return res.status(400).json({
        success: false,
        message: "Selected slot is already booked",
      });
    }

    // 4️⃣ Check if patient already has appointment at the same time
    const conflict = await Appointment.findOne({
      patient: patient._id,
      appointmentDate: appointmentDate,
      "timeSlot.start": timeSlot.start,
      "timeSlot.end": timeSlot.end,
    });

    if (conflict) {
      return res.status(400).json({
        success: false,
        message: "Patient already has an appointment at this time",
      });
    }

    // 5️⃣ Book appointment
    const appointment = new Appointment({
      patient: patient._id,
      doctor: doctorId,
      receptionist: req.user._id,
      appointmentDate,
      timeSlot,
      consultationType: visitingType,
      reason,
      status: "Pending",
      department: departmentId,
    });

    await appointment.save();

    // 6️⃣ Mark slot as booked
    schedule.slots[slotIndex].isBooked = true;
    await schedule.save();

    res.status(201).json({
      success: true,
      message:
        "Patient registered (if new) and appointment booked (pending confirmation)",
      patient: {
        id: patient._id,
        fullName: patient.fullName,
        patientId: patient.patientId,
        email: patient.email,
        contact: patient.contact,
      },
      appointment,
    });
  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error booking appointment",
      error: error.message,
    });
  }
};

// Check doctor availability
async function isDoctorAvailable(doctorId, date, start, end) {
  const conflict = await Appointment.findOne({
    doctor: doctorId,
    appointmentDate: date,
    $or: [
      { "timeSlot.start": { $lt: end, $gte: start } },
      { "timeSlot.end": { $lte: end, $gt: start } },
    ],
  });
  return !conflict;
}

// Book Appointment

export const bookAppointment = async (req, res) => {
  try {
    const {
      patient,
      doctor,
      receptionist,
      appointmentDate, // expect "YYYY-MM-DD" from frontend
      timeSlot, // { start: "10:30", end: "11:00" }
      consultationType,
      reason,
      notes,
      role,
      paymentMode,
    } = req.body;

    // 1️⃣ Validate patient
    let patientExists;
    if (mongoose.Types.ObjectId.isValid(patient)) {
      patientExists = await userModel.findById(patient);
    } else {
      patientExists = await userModel.findOne({ fullName: patient });
    }

    if (!patientExists) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // 2️⃣ Check if patient already has an appointment at this time
    const patientAlreadyBooked = await Appointment.findOne({
      patient: patientExists._id,
      appointmentDate,
      "timeSlot.start": timeSlot.start,
      "timeSlot.end": timeSlot.end,
    });

    if (patientAlreadyBooked) {
      return res.status(400).json({
        success: false,
        message: "Patient already has an appointment at this time",
      });
    }

    // 3️⃣ Check doctor availability
    const available = await isDoctorAvailable(
      doctor,
      appointmentDate,
      timeSlot.start,
      timeSlot.end
    );

    if (!available) {
      return res.status(400).json({
        success: false,
        message: "Doctor not available at this time",
      });
    }

    // 4️⃣ Fetch doctor schedule for marking the slot booked
    const startOfDay = moment
      .utc(appointmentDate, "YYYY-MM-DD")
      .startOf("day")
      .toDate();
    const endOfDay = moment
      .utc(appointmentDate, "YYYY-MM-DD")
      .endOf("day")
      .toDate();

    console.log("sf", startOfDay);
    console.log("sfs", endOfDay);

    const schedule = await DoctorSchedule.findOne({
      doctor,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Doctor schedule not found for this date",
      });
    }

    // 5️⃣ Find the slot in schedule
    const slotIndex = schedule.slots.findIndex(
      (s) => s.start === timeSlot.start && s.end === timeSlot.end
    );

    if (slotIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Selected slot does not exist",
      });
    }

    if (schedule.slots[slotIndex].isBooked) {
      return res.status(400).json({
        success: false,
        message: "Slot already booked",
      });
    }

    // 6️⃣ Payment handling
    let finalPaymentMode = null;
    if (role === "admin") {
      const allowedModes = ["Cash", "Card", "UPI"];
      if (!paymentMode || !allowedModes.includes(paymentMode)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment mode. Allowed: ${allowedModes.join(", ")}`,
        });
      }
      finalPaymentMode = paymentMode;
    }

    if (role === "receptionist") finalPaymentMode = null;

    // 7️⃣ Create appointment
    const appointment = new Appointment({
      patient: patientExists._id,
      doctor,
      receptionist: receptionist || null,
      appointmentDate,
      timeSlot,
      consultationType,
      reason,
      notes,
      paymentMode: finalPaymentMode,
    });

    await appointment.save();
    await appointment.populate("patient doctor receptionist");

    // 8️⃣ Mark slot as booked
    schedule.slots[slotIndex].isBooked = true;
    await schedule.save();

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointment,
    });
  } catch (err) {
    console.error("Booking appointment error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
