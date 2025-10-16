import mongoose from "mongoose";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import moment from "moment";
import Payment from "../../Models/Payments/paymentSchema .js";
import razorpay from "../../Config/Rrazorpay.js"



// ----------------- Helpers -----------------
// ----------------- Helpers -----------------
const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

const formatTime = (minutes) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
};

// ----------------- Helper: Get available slots -----------------
const checkAvailableSlots = async (doctorId, appointmentDate) => {
  const date = new Date(appointmentDate);
  date.setHours(0, 0, 0, 0);

  const schedule = await DoctorSchedule.findOne({ doctor: doctorId, date });
  if (!schedule) throw new Error("Doctor has no schedule on this day");

  return schedule.slots || [];
};

// ----------------- Create Appointment -----------------
export const createPatientAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      appointmentDate,
      timeSlot,
      consultationType,
      reason,
      patientName,
      dob,
      gender,
      email,
      department,
      contactNumber,
      paymentMethod, // "Cash", "UPI", "Card", etc.
    } = req.body;

    // ------------------- CHECK DOCTOR -------------------
    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    // ------------------- FETCH SCHEDULE -------------------
    const startOfDay = moment.utc(appointmentDate, "YYYY-MM-DD").startOf("day").toDate();
    const endOfDay = moment.utc(appointmentDate, "YYYY-MM-DD").endOf("day").toDate();

    const doctorSchedule = await DoctorSchedule.findOne({
      doctor: doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!doctorSchedule) {
      return res.status(404).json({
        message: `No schedule found for this doctor on ${appointmentDate}`,
      });
    }

    // ------------------- FIND SLOT -------------------
    const slot = doctorSchedule.slots.find((s) => s.start === timeSlot && !s.isBooked);
    if (!slot) return res.status(400).json({ message: "Selected time slot is not available" });

    slot.isBooked = true;
    await doctorSchedule.save();

    // ------------------- CREATE APPOINTMENT -------------------
    const newAppointment = await Appointment.create({
      doctor: doctorId,
      patient: req.user ? req.user._id : null,
      patientName,
      dob,
      gender,
      email,
      department,
      contactNumber,
      appointmentDate: moment.utc(appointmentDate, "YYYY-MM-DD").toDate(),
      timeSlot: { start: slot.start, end: slot.end },
      consultationType,
      videoLink: consultationType === "Online" ? null : undefined, // Leave null for online
      reason,
      status: "Pending",
    });

    // ------------------- CALCULATE FEE -------------------
    const durationMultiplier = slot.duration / 30;
    const fee =
      consultationType === "Online"
        ? slot.onlineFee * durationMultiplier
        : slot.offlineFee * durationMultiplier;

    // ------------------- VALIDATE PAYMENT METHOD -------------------
    let paymentMethodOptions = [];
    let channel = "";
    let paymentStatus = "Pending";

    if (consultationType === "Online") {
      paymentMethodOptions = ["UPI", "Card", "NetBanking"];
      channel = "Online";
    } else {
      paymentMethodOptions = ["Cash", "Card"];
      channel = "WalkIn";
      paymentStatus = paymentMethod === "Cash" ? "Paid" : "Pending";
    }

    if (!paymentMethodOptions.includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    // ------------------- CREATE PAYMENT -------------------
    const paymentData = {
      appointment: newAppointment._id,
      patient: req.user ? req.user._id : null,
      method: paymentMethod,
      amount: fee,
      status: paymentStatus,
      type: "Initial",
      channel,
    };

    // For online payments, generate Razorpay order
    if (channel === "Online") {
      const razorpayOrder = await razorpay.orders.create({
        amount: fee * 100, // in paise
        currency: "INR",
        receipt: `receipt_${newAppointment._id}`,
        payment_capture: 1,
      });
      paymentData.razorpayOrderId = razorpayOrder.id;
      paymentData.status = "Pending"; // Wait for payment confirmation
    }

    const newPayment = await Payment.create(paymentData);

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully. Wait for doctor confirmation.",
      appointment: newAppointment,
      payment: newPayment,
    });
  } catch (error) {
    console.error("createAppointment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ----------------- Cancel Appointment -----------------
export const cancelAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const patientId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    if (appointment.patient.toString() !== patientId.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to cancel this appointment" });
    }

    if (!["Pending", "Confirmed"].includes(appointment.status)) {
      return res.status(400).json({
        message: `Cannot cancel an appointment with status: ${appointment.status}`,
      });
    }

    appointment.status = "Cancelled";
    appointment.cancellationReason = req.body?.reason || "Cancelled by patient";
    appointment.cancelledBy = "Patient";
    await appointment.save();

    // ------------------- UPDATE PAYMENT -------------------
    const payment = await Payment.findOne({ appointment: appointmentId });
    if (payment && payment.status !== "Paid") {
      payment.status = "Failed";
      await payment.save();
    }

    res.json({ message: "Appointment cancelled successfully", appointment });
  } catch (err) {
    console.error("Cancel Appointment Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------- Get My Appointments -----------------
export const getMyAppointments = async (req, res) => {
  try {
    const patientId = req.params.id || req.user._id;

    const appointments = await Appointment.find({ patient: patientId })
      .populate("patient", "fullName email age gender")
      .populate({
        path: "doctor",
        select: "_id userId department",
        populate: [
          { path: "userId", select: "fullName email profileImage" },
          { path: "department", select: "name description" },
        ],
      })
      .sort({ appointmentDate: -1 });

    res.status(200).json({ success: true, appointments });
  } catch (err) {
    console.error("Get My Appointments Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------- Get Appointment By ID -----------------
export const getAppointmentById = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "fullName email age gender")
      .populate({
        path: "doctor",
        select: "_id userId department",
        populate: [
          { path: "userId", select: "fullName email profileImage" },
          { path: "department", select: "name description" },
        ],
      });

    if (!appointment)
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });

    res.status(200).json({ success: true, appointment });
  } catch (err) {
    console.error("Get Appointment By ID Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------- Reschedule Appointment -----------------
const getAvailableSlotsForDate = async (doctorId, date) => {
  const schedule = await DoctorSchedule.findOne({
    doctor: doctorId,
    date: new Date(date),
  });
  if (!schedule) throw new Error("Doctor has no schedule on this day");
  return schedule.slots.filter((slot) => !slot.isBooked);
};

const getFirstAvailableDate = async (doctorId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const schedule = await DoctorSchedule.findOne({
    doctor: doctorId,
    date: { $gte: today },
    "slots.isBooked": false,
  }).sort({ date: 1 });
  if (!schedule) return null;
  return {
    date: schedule.date,
    slots: schedule.slots.filter((s) => !s.isBooked),
  };
};

export const rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    let { appointmentDate, timeSlot } = req.body || {};
    const patientId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointment ID" });

    const appointment = await Appointment.findById(id);
    if (!appointment)
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });

    if (appointment.patient.toString() !== patientId.toString())
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to reschedule" });

    if (!["Pending", "Confirmed"].includes(appointment.status))
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule with status: ${appointment.status}`,
      });

    if (!appointmentDate || !timeSlot) {
      const firstAvailable = await getFirstAvailableDate(appointment.doctor);
      if (!firstAvailable)
        return res.status(400).json({
          success: false,
          message: "Doctor has no available schedule in the future",
        });
      appointmentDate = firstAvailable.date;
      timeSlot = firstAvailable.slots[0];
    }

    if (!appointmentDate || !timeSlot || !timeSlot.start || !timeSlot.end)
      return res.status(400).json({
        success: false,
        message: "appointmentDate and valid timeSlot {start, end} are required",
      });

    const availableSlots = await getAvailableSlotsForDate(
      appointment.doctor,
      appointmentDate
    );
    const slotAvailable = availableSlots.some(
      (slot) =>
        slot.start === timeSlot.start &&
        slot.end === timeSlot.end &&
        !slot.isBooked
    );

    if (!slotAvailable)
      return res
        .status(400)
        .json({ success: false, message: "Selected slot is not available" });

    const newDate = new Date(appointmentDate);
    newDate.setHours(0, 0, 0, 0);
    appointment.appointmentDate = newDate;
    appointment.timeSlot = { start: timeSlot.start, end: timeSlot.end };
    appointment.status = "Pending";
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      appointment,
    });
  } catch (err) {
    console.error("Reschedule Appointment Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

// ----------------- Get Available Slots (API) -----------------
export const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date)
      return res
        .status(400)
        .json({ success: false, message: "doctorId and date are required" });

    const slots = await checkAvailableSlots(doctorId, date);
    // console.log(slots);
    
    res.status(200).json({ success: true, slots });
  } catch (err) {
    console.error("Get Available Slots Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// ----------------- Delete Appointment -----------------
export const deletePatientAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const patientId = req.user.id;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patient: patientId,
    });
    if (!appointment)
      return res.status(404).json({
        success: false,
        message: "Appointment not found or not yours",
      });

    // Free the slot
    await DoctorSchedule.updateOne(
      { doctor: appointment.doctor, "slots._id": appointment.timeSlot._id },
      { $set: { "slots.$.isBooked": false } }
    );

    await Appointment.deleteOne({ _id: appointmentId });
    res.json({ success: true, message: "Appointment deleted successfully" });
  } catch (err) {
    console.error("Error deleting appointment:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
