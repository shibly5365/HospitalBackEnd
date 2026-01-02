import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import Payment from "../../Models/Payments/paymentSchema.js";
import userModel from "../../Models/User/UserModels.js";

// ===============================
// 1️⃣ CREATE APPOINTMENT (PATIENT)

// ===============================
export const patientCreateAppointment = async (req, res) => {
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

    if (!paymentMethod)
      return res.status(400).json({
        success: false,
        message: "Please select a payment method before booking appointment",
      });

    if (!doctorId)
      return res.status(400).json({
        success: false,
        message: "Doctor ID is required",
      });

    const doctorDoc = await doctorModel.findById(doctorId);
    if (!doctorDoc)
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });

    const user = await userModel.findById(patientId);
    if (!user)
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });

    // 🔥 Slot Blocking Check (Pending / Confirmed / With-Doctor)
    const overlapping = await Appointment.findOne({
      doctor: doctorId,
      appointmentDate,
      "timeSlot.start": timeSlot.start,
      "timeSlot.end": timeSlot.end,
      status: { $in: ["Pending", "Confirmed", "With-Doctor"] },
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: "Slot already booked",
      });
    }

    // Calculate Fee
    let finalFee = doctorDoc.consultationFee;
    if (consultationType?.toLowerCase() === "online") {
      finalFee += 300;
    }

    // Create Appointment
    let appointment;
    try {
      appointment = await Appointment.create({
        patient: patientId,
        doctor: doctorId,
        appointmentDate,
        timeSlot,
        consultationType,
        reason,

        patientDetails: {
          fullName: user.fullName,
          dob: user.dob,
          age: user.age,
          gender: user.gender,
          email: user.email,
          phone: user.contact,
          address: {
            street: user.address?.street,
            city: user.address?.city,
            state: user.address?.state,
            zip: user.address?.zip,
          },
          emergencyContact: {
            name: user.emergencyContact?.name,
            phone: user.emergencyContact?.number,
          },
          insuranceInfo: user.insuranceInfo,
        },

        consultationFee: finalFee,
        paymentStatus: "Pending",
        status: "Pending",
      });
    } catch (err) {
      // 🔥 If two patients click "book" at same millisecond → handle duplicate slot creation
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Slot already booked. Please try another time.",
        });
      }
      throw err;
    }

    // Create Payment Document
    const payment = await Payment.create({
      appointment: appointment._id,
      patient: patientId,
      doctor: doctorId,
      method: paymentMethod,
      amount: finalFee,
      status: "Pending",
    });

    appointment.payments.push(payment._id);
    await appointment.save();

    return res.status(201).json({
      success: true,
      message: "Appointment & Payment created successfully",
      appointment,
      payment,
    });
  } catch (error) {
    return res.status(500).json({
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
      (d) => d.trim().slice(0, 3) // normalize to "Mon"
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

    const appointment = await Appointment.findById(id);
    if (!appointment)
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });

    if (appointment.patient.toString() !== userId.toString())
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });

    // Mark as cancelled
    appointment.status = "Cancelled";

    // 🔥 Free the Doctor Slot (IMPORTANT FIX)
    await DoctorSchedule.updateOne(
      { doctor: appointment.doctor, date: appointment.appointmentDate },
      { $set: { "slots.$[elem].isBooked": false } },
      {
        arrayFilters: [
          {
            "elem.start": appointment.timeSlot.start,
            "elem.end": appointment.timeSlot.end,
          },
        ],
      }
    );

    // Refund if payment already completed
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

    await appointment.save();

    return res.json({
      success: true,
      message: "Appointment cancelled",
      appointment,
    });
  } catch (error) {
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


