import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import mongoose from "mongoose";
import Payment from "../../Models/Payments/paymentSchema.js";
import userModel from "../../Models/User/UserModels.js";

// ===============================
// 1️⃣ CREATE APPOINTMENT (PATIENT)

// ===============================

export const patientCreateAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const patientId = req.user._id;
    const doctorId = req.body.doctor || req.body.doctorId;

    const {
      appointmentDate,
      timeSlot,
      consultationType,
      reason,
      paymentMethod,
    } = req.body;

    if (!paymentMethod) {
      throw new Error("Payment method is required");
    }

    const doctorDoc = await doctorModel.findById(doctorId);
    if (!doctorDoc) throw new Error("Doctor not found");

    const user = await userModel.findById(patientId);
    if (!user) throw new Error("Patient not found");

    // 🔒 Slot check
    const overlapping = await Appointment.findOne({
      doctor: doctorId,
      appointmentDate,
      "timeSlot.start": timeSlot.start,
      "timeSlot.end": timeSlot.end,
      status: { $in: ["Pending", "Confirmed", "With-Doctor"] },
    });

    if (overlapping) {
      throw new Error("Slot already booked");
    }

    // 💰 Fee Calculation
    let finalFee = doctorDoc.consultationFee;
    if (consultationType?.toLowerCase() === "online") {
      finalFee += 300;
    }
    // 🧠 Check if patient already booked before
    const existingAppointment = await Appointment.findOne({
      patient: patientId,
      status: { $in: ["Confirmed", "Completed", "With-Doctor"] },
    });

    // 🎯 Decide patient type
    let patientType = "New Patient";
    if (existingAppointment) {
      patientType = "Returning Patient";
    }

    // 🧾 Create Appointment
    const appointment = await Appointment.create(
      [
        {
          patient: patientId,
          doctor: doctorId,
          appointmentDate,
          timeSlot,
          consultationType,
          reason,
          patientType,

          patientDetails: {
            fullName: user.fullName,
            gender: user.gender,
            email: user.email,
            phone: user.contact,
          },

          consultationFee: finalFee,
          paymentStatus: "Pending",
          status: "Pending",
        },
      ],
      { session },
    );

    // 🔢 Generate Payment ID
    const count = await Payment.countDocuments();
    const paymentId = `PAY-${new Date().getFullYear()}-${(count + 1)
      .toString()
      .padStart(3, "0")}`;

    // 🧾 Create Payment
    const payment = await Payment.create(
      [
        {
          paymentId,
          appointment: appointment[0]._id,
          patient: patientId,
          doctor: doctorId,
          method: paymentMethod,
          amount: finalFee,
          type: "Consultation",
          status: "Pending",

          items: [
            {
              title: "Consultation Fee",
              amount: doctorDoc.consultationFee,
            },
            ...(consultationType === "online"
              ? [{ title: "Online Charge", amount: 300 }]
              : []),
          ],
        },
      ],
      { session },
    );

    // 🔗 Link payment to appointment
    appointment[0].payments = [payment[0]._id];
    await appointment[0].save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Appointment & Payment created successfully",
      appointment: appointment[0],
      payment: payment[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// 2️⃣ GET ALL PATIENT APPOINTMENTS (HISTORY)
// ===============================
export const patientGetMyAppointments = async (req, res) => {
  try {
    const patientId = req.user._id;
    const appointments = await Appointment.find({ patient: patientId })
      .populate({
        path: "doctor",
        select: "userId department specialization Name",
        populate: [
          { path: "userId", select: "fullName email" },
          { path: "department", select: "name" },
        ],
      })
      .populate("payments")
      .sort({ appointmentDate: -1 });

    res.json({ success: true, appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===============================
// 3️⃣ GET APPOINTMENT BY ID (PATIENT OR DOCTOR)
// ===============================
export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id)
      .populate("doctor", "userId specialization")
      .populate("patient", "fullName email contact")
      .populate("payments");

    if (!appointment)
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });

    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===============================
// 4️⃣ UPDATE / RESCHEDULE APPOINTMENT (PATIENT)
// ===============================
export const updateAppointment = async (req, res) => {
  try {
    const patientId = req.user._id;
    const { id } = req.params;
    const { appointmentDate, timeSlot, reason } = req.body;

    const appointment = await Appointment.findById(id).populate("doctor");
    if (!appointment)
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });

    if (appointment.patient.toString() !== patientId.toString())
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    const doctor = appointment.doctor;

    // --- FIXED DAY CHECK ---
    const dayName = new Date(appointmentDate)
      .toLocaleString("en-US", { weekday: "short" })
      .trim(); // e.g. "Thu"

    const doctorDays = doctor.availableDays.map(
      (d) => d.trim().slice(0, 3), // normalize to "Mon"
    );

    if (!doctorDays.includes(dayName)) {
      return res.status(400).json({
        success: false,
        message: `Doctor is not available on ${dayName}`,
      });
    }

    // --- CHECK SLOT OVERLAP ---
    const overlapping = await Appointment.findOne({
      doctor: doctor._id,
      appointmentDate,
      "timeSlot.start": timeSlot.start,
      _id: { $ne: id },
      status: { $in: ["Pending", "Confirmed", "With-Doctor", "Upcoming"] },
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: "This slot is already booked",
      });
    }

    // --- UPDATE ---
    appointment.appointmentDate = appointmentDate;
    appointment.timeSlot = timeSlot;
    appointment.reason = reason || appointment.reason;
    appointment.status = "Pending";

    await appointment.save();

    res.json({
      success: true,
      message: "Appointment rescheduled successfully",
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===============================
// 5️⃣ CANCEL APPOINTMENT (PATIENT)
// ===============================
export const patientCancelAppointment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    // 1️⃣ Find appointment
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // 2️⃣ Authorization check
    if (appointment.patient.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    // 3️⃣ Prevent double cancellation
    if (appointment.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Appointment already cancelled",
      });
    }

    // 4️⃣ Mark appointment as cancelled
    appointment.status = "Cancelled";

    // 5️⃣ Normalize date (🔥 IMPORTANT FIX)
    const scheduleDate = new Date(appointment.appointmentDate);
    scheduleDate.setHours(0, 0, 0, 0);

    // 6️⃣ Free the doctor's slot
    const slotUpdateResult = await DoctorSchedule.updateOne(
      {
        doctor: appointment.doctor,
        date: scheduleDate,
      },
      {
        $set: { "slots.$[elem].isBooked": false },
      },
      {
        arrayFilters: [
          {
            "elem.start": appointment.timeSlot.start,
            "elem.end": appointment.timeSlot.end,
          },
        ],
      },
    );

    // 7️⃣ Optional safety log
    if (slotUpdateResult.modifiedCount === 0) {
      console.warn("⚠️ Slot not freed. Schedule not matched:", {
        doctor: appointment.doctor,
        date: scheduleDate,
        slot: appointment.timeSlot,
      });
    }

    console.log(scheduleDate);

    // 8️⃣ Refund if payment was completed
    if (appointment.paymentStatus === "Paid") {
      const payment = await Payment.findOne({
        appointment: id,
        status: "Paid",
      });

      if (payment) {
        payment.status = "Refunded";
        payment.type = "Refund";
        await payment.save();

        appointment.paymentStatus = "Refunded";
      }
    }

    // 9️⃣ Save appointment
    await appointment.save();

    // 🔟 Final response
    return res.json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment,
    });
  } catch (error) {
    console.error("Cancel appointment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// 6️⃣ DELETE APPOINTMENT (PATIENT CAN DELETE CANCELLED/REJECTED)
// ===============================
export const deleteAppointment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    if (!appointment)
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });

    if (appointment.patient.toString() !== userId.toString())
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    if (!["Cancelled", "Rejected"].includes(appointment.status))
      return res.status(400).json({
        success: false,
        message: "Only cancelled or rejected appointments can be deleted",
      });

    await appointment.deleteOne();
    res.json({ success: true, message: "Appointment deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===============================
// 7️⃣ DOCTOR GET ALL APPOINTMENTS
// ===============================
export const getDoctorAppointments = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const appointments = await Appointment.find({ doctor: doctor._id })
      .populate("patient", "fullName email contact")
      .populate("payments")
      .sort({ appointmentDate: -1 });

    res.json({ success: true, appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===============================
// 8️⃣ DOCTOR UPDATE STATUS (CONFIRM / REJECT)
// ===============================
export const updateAppointmentStatus = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const { id } = req.params;
    const { status } = req.body; // "Confirmed" or "Rejected"

    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const appointment = await Appointment.findOne({
      _id: id,
      doctor: doctor._id,
    });
    if (!appointment)
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });

    appointment.status = status;
    await appointment.save();

    res.json({
      success: true,
      message: `Appointment ${status.toLowerCase()}`,
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// get all appointment history
export const getDoctorAppointmentHistory = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const appointments = await Appointment.find({
      doctor: doctor._id,
      status: { $in: ["confirmed", "completed", "cancelled", "rejected"] },
    })
      .populate("patient", "fullName email contact")
      .sort({ appointmentDate: -1 });

    res.json({ success: true, appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTodayPatientAppointments = async (req, res) => {
  try {
    const patientId = req.user._id;

    // 🔥 Start & End of Today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      patient: patientId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["Pending", "Confirmed", "With-Doctor", "Upcoming"] },
    })
      .populate({
        path: "doctor",
        select: "userId department specialization Name",
        populate: [
          { path: "userId", select: "fullName email" },
          { path: "department", select: "name" },
        ],
      })
      .populate("payments")
      .sort({ "timeSlot.start": 1 });

    return res.json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
