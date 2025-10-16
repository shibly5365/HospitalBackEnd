import nodemailer from "nodemailer";
import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import userModel from "../../Models/User/UserModels.js";
import DoctorLeave from "../../Models/LeaveRequest/LeaveSchema.js";
import DepartmentModle from "../../Models/Departmenst/DepartmenstModels.js";
import moment from "moment";
import Payment from "../../Models/Payments/paymentSchema .js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";

// ------------------------------
// Nodemailer transporter
// ------------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

// ------------------------------
// Get doctor appointments
// ------------------------------
export const getAppointments = async (req, res) => {
  try {
    const doctorId = req.user._id;

    // find doctor linked with this user
    const doctor = await doctorModel.findOne({ userId: doctorId });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    // base filter → always doctor appointments
    const filter = {
      doctor: doctor._id,
      status: { $ne: "Cancelled" },
    };

    // if query param passed (Confirmed / Pending / Completed)
    if (req.query.status) filter.status = req.query.status;

    const appointments = await Appointment.find(filter)
      .populate("patient", "fullName email contact age gender address")
      .populate("receptionist", "fullName email contact") // who created if receptionist
      .populate("createdBy", "fullName email role") // if you store createdBy = admin/patient/receptionist
      .sort({ appointmentDate: 1, "timeSlot.start": 1 });

    res.status(200).json({
      success: true,
      message: appointments.length
        ? "Appointments fetched successfully"
        : "No appointments found",
      appointments,
    });
  } catch (error) {
    console.error("Get Appointments Error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------------------
// Update appointment status (confirm, cancel, complete)
// ------------------------------
export const updateAppointmentStatus = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { appointmentId, status, notes, prescription, diagnosis } = req.body;

    const allowedStatuses = [
      "Confirmed",
      "Cancelled",
      "Completed",
      "With-Doctor",
    ];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const doctor = await doctorModel
      .findOne({ userId: doctorId })
      .populate("userId");
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }

    const appointment = await Appointment.findById(appointmentId).populate(
      "patient"
    );
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    if (appointment.doctor.toString() !== doctor._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // ------------------- CONFIRMED STATUS -------------------
    if (status === "Confirmed" && !appointment.tokenNumber) {
      const dayStart = moment(appointment.appointmentDate)
        .startOf("day")
        .toDate();
      const dayEnd = moment(appointment.appointmentDate).endOf("day").toDate();

      const sameDayConfirmedCount = await Appointment.countDocuments({
        doctor: doctor._id,
        appointmentDate: { $gte: dayStart, $lte: dayEnd },
        status: "Confirmed",
      });

      appointment.tokenNumber = sameDayConfirmedCount + 1;

      // Update payment status
      await Payment.findOneAndUpdate(
        { appointment: appointment._id },
        { status: "Paid" }
      );

      // ------------------- ONLINE CONSULTATION LINK -------------------
      if (appointment.consultationType === "Online" && !appointment.videoLink) {
        // Generate unique video link (Jitsi example)
        const videoLink = `https://meet.jit.si/${uuidv4()}`;
        appointment.videoLink = videoLink;
      }
    }

    // ------------------- COMPLETED STATUS -------------------
    if (status === "Completed") {
      // Create medical record if doctor provided prescription/diagnosis
      if (prescription || diagnosis || notes) {
        const medicalRecord = await MedicalRecord.create({
          appointment: appointment._id,
          patient: appointment.patient._id,
          doctor: doctor._id,
          prescription: prescription || [],
          diagnosis: diagnosis || "",
          notes: notes || "",
          followUpDate: null,
          attachments: [],
          vitals: {},
        });

        // Link medical record to appointment
        appointment.medicalRecord = medicalRecord._id;
      }
    }

    appointment.status = status;
    if (notes) appointment.notes = notes;
    await appointment.save();

    // ------------------- CANCELLED STATUS -------------------
    if (status === "Cancelled") {
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
    }

    // ------------------- SEND EMAIL -------------------
    let mailSubject = "";
    let mailBody = "";

    if (status === "Confirmed") {
      mailSubject = "Appointment Confirmed";
      mailBody = `Hello ${appointment.patient.fullName},

Your appointment with Dr. ${doctor.userId.fullName} on ${moment(
        appointment.appointmentDate
      ).format("MMMM Do, YYYY")} at ${appointment.timeSlot.start} is confirmed.

${notes ? "Doctor's note: " + notes + "\n\n" : ""}
Thank you for choosing our services!`;
    } else if (status === "Cancelled") {
      mailSubject = "Appointment Cancelled";
      mailBody = `Hello ${appointment.patient.fullName},

Your appointment with Dr. ${doctor.userId.fullName} on ${moment(
        appointment.appointmentDate
      ).format("MMMM Do, YYYY")} at ${
        appointment.timeSlot.start
      } has been cancelled.

${notes ? "Doctor's note: " + notes + "\n\n" : ""}
If you have questions or want to reschedule, please contact us.`;
    }

    if (mailSubject && mailBody && appointment.patient.email) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL,
          to: appointment.patient.email,
          subject: mailSubject,
          text: mailBody,
        });
      } catch (err) {
        console.error("Error sending email:", err.message);
      }
    }

    res.status(200).json({
      message: `Appointment ${status} successfully`,
      appointment,
    });
  } catch (error) {
    console.error("Update Appointment Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------------------
// Doctor sets next appointment for patient
// ------------------------------
export const setNextAppointment = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const {
      previousAppointmentId,
      appointmentDate,
      timeSlot,
      consultationType,
      reason,
      duration,
    } = req.body;

    const doctor = await doctorModel.findOne({ userId: doctorId });
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    const prevAppointment = await Appointment.findById(previousAppointmentId);
    if (!prevAppointment)
      return res
        .status(404)
        .json({ message: "Previous appointment not found" });

    // Create next appointment
    const nextAppointment = await Appointment.create({
      patient: prevAppointment.patient,
      doctor: doctor._id,
      appointmentDate,
      timeSlot,
      consultationType,
      reason,
      duration,
      previousAppointment: prevAppointment._id,
    });

    // Link previous appointment
    prevAppointment.nextAppointment = nextAppointment._id;
    await prevAppointment.save();

    res.status(201).json({
      success: true,
      message: "Next appointment set successfully",
      appointment: nextAppointment,
    });
  } catch (error) {
    console.error("Set Next Appointment Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const createAppointmentByDoctor = async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      appointmentDate,
      timeSlot,
      consultationType,
      reason,
      notes,
      status,
      duration,
    } = req.body;

    // Validate required fields
    if (
      !patientId ||
      !doctorId ||
      !appointmentDate ||
      !timeSlot?.start ||
      !timeSlot?.end
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if doctor exists
    const doctor = await doctorModel.findById(doctorId);
    console.log(doctor);

    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    // Check if patient exists
    const patient = await userModel.findById(patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    // Check if the doctor already has an appointment in this slot
    const existing = await Appointment.findOne({
      doctor: doctorId,
      appointmentDate,
      "timeSlot.start": timeSlot.start,
      "timeSlot.end": timeSlot.end,
      status: { $in: ["Pending", "Confirmed", "With-Doctor"] },
    });

    if (existing)
      return res
        .status(400)
        .json({ message: "This time slot is already booked" });

    // Create new appointment
    const appointment = new Appointment({
      patient: patientId,
      doctor: doctorId,
      createdBy: req.user._id, // Doctor or receptionist creating the appointment
      appointmentDate,
      timeSlot,
      consultationType: consultationType || "Offline",
      reason,
      notes,
      status: status || "Pending",
      duration: duration || 30,
    });

    await appointment.save();

    res.status(201).json({ success: true, appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getDoctorAvailability = async (req, res) => {
  try {
    const { month, year } = req.query;
    const userId = req.user.id; // Logged-in user ID

    if (!month || !year)
      return res
        .status(400)
        .json({ success: false, message: "month and year are required" });

    // Find doctor linked to user
    // ✅ correct
    let doctor = await doctorModel.findOne({ userId });
    if (!doctor) {
      const defaultDept = await DepartmentModle.findOne();
      if (!defaultDept)
        return res
          .status(500)
          .json({ success: false, message: "No department found in DB" });

      doctor = await doctorModel.create({
        userId, // <-- match schema field
        qualification: "Not Set",
        specialization: "Not Set",
        department: defaultDept._id,
        availableSlots: [],
      });
    }

    const m = Number(month);
    const y = Number(year);
    const daysInMonth = new Date(y, m, 0).getDate();
    const events = [];

    const leaves = await DoctorLeave.find({
      doctor: doctor._id,
      status: "approved",
      startDate: { $lte: new Date(y, m - 1, daysInMonth) },
      endDate: { $gte: new Date(y, m - 1, 1) },
    });

    const appointments = await Appointment.find({
      doctor: doctor._id,
      appointmentDate: {
        $gte: new Date(y, m - 1, 1),
        $lte: new Date(y, m - 1, daysInMonth),
      },
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = new Date(y, m - 1, day).toISOString().split("T")[0];

      // Check leave
      const onLeave = leaves.some(
        (l) =>
          new Date(l.startDate) <= new Date(dateStr) &&
          new Date(l.endDate) >= new Date(dateStr)
      );
      if (onLeave) {
        events.push({ title: "Excused", start: dateStr, color: "blue" });
        continue;
      }

      // Check available slots
      if (!doctor.availableSlots || doctor.availableSlots.length === 0) {
        events.push({ title: "Unavailable", start: dateStr, color: "gray" });
        continue;
      }

      // Check booked appointments
      const hasAppointment = appointments.some(
        (a) => a.appointmentDate.toISOString().split("T")[0] === dateStr
      );
      events.push({
        title: hasAppointment ? "Booked" : "Available",
        start: dateStr,
        color: hasAppointment ? "red" : "green",
      });
    }

    res.status(200).json({ success: true, events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};
