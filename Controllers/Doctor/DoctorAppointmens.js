// controllers/doctorAppointmentController.js
import mongoose from "mongoose";
import moment from "moment";
import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";
import Payment from "../../Models/Payments/paymentSchema.js";
import userModel from "../../Models/User/UserModels.js";
import { v4 as uuidv4 } from "uuid";

// Helper
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ----------------- Get All Appointments (doctor) -----------------

export const getAllAppointments = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    // ✅ Find Doctor
    const doctor = await doctorModel
      .findOne({ userId: doctorUserId })
      .select("_id")
      .lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // ✅ Base Filter
    const filter = {
      doctor: doctor._id,
    };

    // ✅ Status Filter
    if (req.query.status && req.query.status !== "All") {
      filter.status = req.query.status;
    } else {
      filter.status = {
        $ne: "Cancelled",
      };
    }

    // ✅ Date Filter
    const { dateFrom, dateTo } = req.query;

    if (dateFrom || dateTo) {
      const start = dateFrom
        ? moment.utc(dateFrom).startOf("day").toDate()
        : new Date(0);

      const end = dateTo
        ? moment.utc(dateTo).endOf("day").toDate()
        : moment.utc().endOf("day").toDate();

      filter.appointmentDate = {
        $gte: start,
        $lte: end,
      };
    }
    // ✅ Quick Date Filters
    const quickFilter = req.query.quickFilter;

    if (quickFilter) {
      let start;
      let end;

      switch (quickFilter) {
        case "Today":
          start = moment.utc().startOf("day").toDate();
          end = moment.utc().endOf("day").toDate();
          break;

        case "Tomorrow":
          start = moment.utc().add(1, "day").startOf("day").toDate();
          end = moment.utc().add(1, "day").endOf("day").toDate();
          break;

        case "ThisWeek":
          start = moment.utc().startOf("week").toDate();
          end = moment.utc().endOf("week").toDate();
          break;

        case "NextWeek":
          start = moment.utc().add(1, "week").startOf("week").toDate();

          end = moment.utc().add(1, "week").endOf("week").toDate();

          break;

        default:
          break;
      }

      if (start && end) {
        filter.appointmentDate = {
          $gte: start,
          $lte: end,
        };
      }
    }

    // ✅ Search Filter
    if (req.query.search) {
      const q = req.query.search.trim();

      filter.$or = [
        {
          "patientDetails.fullName": {
            $regex: q,
            $options: "i",
          },
        },
        {
          "patientDetails.email": {
            $regex: q,
            $options: "i",
          },
        },
        {
          "patientDetails.phone": {
            $regex: q,
            $options: "i",
          },
        },
      ];
    }

    // ✅ Pagination
    const page = Math.max(1, parseInt(req.query.page || "1", 10));

    const limit = Math.max(
      1,
      Math.min(100, parseInt(req.query.limit || "25", 10)),
    );

    const skip = (page - 1) * limit;

    // ✅ Fetch Appointments
    const [appointments, total] = await Promise.all([
      Appointment.find(filter)

        // ✅ Only for profile image/account info
        .populate("patient", "profileImage patientId")

        .populate({
          path: "doctor",
          select: "userId department",
          populate: [
            {
              path: "userId",
              select: "fullName email profileImage",
            },
          ],
        })

        .populate("payments", "status amount method")

        .populate("medicalRecord", "_id")

        .select(
          `
            _id
            patient
            patientDetails
            doctor
            payments
            medicalRecord
            appointmentDate
            timeSlot
            status
            reason
            consultationType
            paymentStatus
            tokenNumber
            createdAt
          `,
        )

        .sort({
          appointmentDate: 1,
          "timeSlot.start": 1,
        })

        .skip(skip)
        .limit(limit)
        .lean(),

      Appointment.countDocuments(filter),
    ]);

    // ✅ Final Format
    const finalAppointments = appointments.map((appt) => ({
      _id: appt._id,

      patient: {
        _id: appt.patient?._id,

        patientId: appt.patient?.patientId,

        profileImage: appt.patient?.profileImage,

        // ✅ Snapshot Data
        fullName: appt.patientDetails?.fullName || "Unknown",

        email: appt.patientDetails?.email || "",

        contact: appt.patientDetails?.phone || "",

        gender: appt.patientDetails?.gender || "",

        age: appt.patientDetails?.age || "",

        dob: appt.patientDetails?.dob || null,
      },

      doctor: {
        _id: appt.doctor?._id,

        name: appt.doctor?.userId?.fullName,

        email: appt.doctor?.userId?.email,

        profileImage: appt.doctor?.userId?.profileImage,
      },

      appointmentDate: appt.appointmentDate,

      timeSlot: appt.timeSlot,

      consultationType: appt.consultationType,

      status: appt.status,

      paymentStatus: appt.paymentStatus,

      tokenNumber: appt.tokenNumber,

      reason: appt.reason,

      payments: appt.payments,

      medicalRecord: appt.medicalRecord,

      createdAt: appt.createdAt,
    }));

    // ✅ Response
    return res.status(200).json({
      success: true,

      page,

      limit,

      total,

      count: finalAppointments.length,

      appointments: finalAppointments,
    });
  } catch (err) {
    console.error("getAllAppointments (doctor):", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ----------------- Get Today's Appointments -----------------
export const getTodaysAppointments = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const startOfDay = moment.utc().startOf("day").toDate();
    const endOfDay = moment.utc().endOf("day").toDate();

    const todaysAppointments = await Appointment.find({
      doctor: doctor._id,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: "Cancelled" },
    })
      .populate("patient", "fullName email contact gender profileImage")
      .sort({ "timeSlot.start": 1 });

    return res.status(200).json({
      success: true,
      count: todaysAppointments.length,
      appointments: todaysAppointments,
    });
  } catch (err) {
    console.error("getTodaysAppointments:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------- Get Next Upcoming Appointment -----------------
export const getTodaysNextAppointment = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    // ============================
    // GET DOCTOR PROFILE
    // ============================
    const doctor = await doctorModel.findOne({
      userId: doctorUserId,
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // ============================
    // TODAY RANGE
    // ============================
    const today = new Date();

    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0,
      0,
      0,
    );

    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
    );

    // ============================
    // NEXT APPOINTMENT
    // ============================
    const nextAppointment = await Appointment.findOne({
      doctor: doctor._id,
      appointmentDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: {
        $in: ["Pending", "Confirmed", "With-Doctor"],
      },
    })
      .sort({
        appointmentDate: 1,
        "timeSlot.start": 1,
      })
      .populate(
        "patient",
        `
        fullName
        age
        gender
        bloodGroup
        contact
        email
        patientId
        allergies
        chronicConditions
        profileImage
      `,
      );

    if (!nextAppointment) {
      return res.status(200).json({
        success: true,
        message: "No upcoming appointments today",
        appointment: null,
      });
    }

    const patientId = nextAppointment.patient?._id;

    // ============================
    // TOTAL VISITS
    // ============================
    const totalVisits = await Appointment.countDocuments({
      doctor: doctor._id,
      patient: patientId,
      status: "Completed",
    });

    // ============================
    // LAST VISIT
    // ============================
    const lastVisit = await Appointment.findOne({
      doctor: doctor._id,
      patient: patientId,
      status: "Completed",
      _id: { $ne: nextAppointment._id },
    })
      .sort({ appointmentDate: -1 })
      .select("appointmentDate reason completedAt consultationType");

    // ============================
    // COUNTDOWN
    // ============================
    let minutesRemaining = null;

    try {
      if (nextAppointment.timeSlot?.start) {
        const [hours, minutes] = nextAppointment.timeSlot.start.split(":");

        const appointmentTime = new Date(nextAppointment.appointmentDate);

        appointmentTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        minutesRemaining = Math.max(
          0,
          Math.floor((appointmentTime - new Date()) / 60000),
        );
      }
    } catch (error) {
      console.log("Countdown calculation error");
    }

    // ============================
    // RESPONSE
    // ============================
    return res.status(200).json({
      success: true,
      message: "Next appointment fetched",

      data: {
        patient: {
          id: nextAppointment.patient?._id,
          patientId: nextAppointment.patient?.patientId,
          profileImage: nextAppointment.patient?.profileImage,

          fullName: nextAppointment.patient?.fullName,

          age: nextAppointment.patient?.age,

          gender: nextAppointment.patient?.gender,

          bloodGroup: nextAppointment.patient?.bloodGroup,

          phone: nextAppointment.patient?.contact,

          email: nextAppointment.patient?.email,

          allergies: nextAppointment.patient?.allergies,

          chronicConditions: nextAppointment.patient?.chronicConditions,
        },

        appointment: {
          appointmentId: nextAppointment._id,

          date: nextAppointment.appointmentDate,

          timeSlot: nextAppointment.timeSlot,

          consultationType: nextAppointment.consultationType,

          status: nextAppointment.status,

          reason: nextAppointment.reason,

          isFollowUp: nextAppointment.isFollowUp,

          tokenNumber: nextAppointment.tokenNumber,

          duration: nextAppointment.duration,
        },

        visitSummary: {
          totalVisits,

          lastVisitDate: lastVisit?.appointmentDate || null,

          lastVisitReason: lastVisit?.reason || null,

          lastConsultationType: lastVisit?.consultationType || null,

          lastCompletedAt: lastVisit?.completedAt || null,
        },

        countdown: {
          minutesRemaining,
        },
      },
    });
  } catch (err) {
    console.error("getTodaysNextAppointment error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ----------------- Get Appointment By ID (doctor view) -----------------
export const getAppointmentById = async (req, res) => {
  try {
    const appointmentId = req.params.id;

    // ✅ validate appointment id
    if (!isValidObjectId(appointmentId))
      return res.status(400).json({
        success: false,
        message: "Invalid appointment id",
      });

    // ✅ get appointment with populated data
    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "fullName email contact age gender address")
      .populate({
        path: "doctor",
        populate: {
          path: "userId",
          select: "fullName email contact profileImage",
        },
      })
      .populate("medicalRecord")
      .populate("payments");

    // ✅ appointment not found
    if (!appointment)
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });

    // ✅ logged user id
    const doctorUserId = req.user._id;

    // ✅ find doctor document
    const doctor = await doctorModel.findOne({
      userId: doctorUserId,
    });

    // ✅ doctor not found
    if (!doctor)
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });

    // ✅ authorization check
    if (appointment.doctor._id.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this appointment",
      });
    }

    // ✅ success response
    return res.status(200).json({
      success: true,
      appointment,
    });
  } catch (err) {
    console.error("getAppointmentById (doctor):", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ----------------- Update Appointment Status (Confirm / Cancel / Completed / With-Doctor) -----------------

export const updateAppointmentStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const appointmentId = req.params.id;
    const { status, notes } = req.body;

    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointmentId" });
    const allowedStatuses = [
      "Confirmed",
      "Cancelled",
      "Completed",
      "With-Doctor",
    ];
    if (!allowedStatuses.includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });

    const doctor = await doctorModel.findOne({ userId: req.user._id });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const appointment =
      await Appointment.findById(appointmentId).session(session);

    if (!appointment) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    if (appointment.doctor.toString() !== doctor._id.toString()) {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // ✅ Confirmed

    if (status === "Confirmed" && !appointment.tokenNumber) {
      appointment.status = "Confirmed";

      // ✅ Update Slot Status
      await DoctorSchedule.updateOne(
        {
          doctor: appointment.doctor,
          date: appointment.appointmentDate,
        },
        {
          $set: {
            "slots.$[elem].bookingStatus": "Confirmed",
          },
        },
        {
          arrayFilters: [
            {
              "elem.start": appointment.timeSlot.start,

              "elem.end": appointment.timeSlot.end,
            },
          ],
          session,
        },
      );

      const dayStart = moment
        .utc(appointment.appointmentDate)
        .startOf("day")
        .toDate();

      const dayEnd = moment
        .utc(appointment.appointmentDate)
        .endOf("day")
        .toDate();

      const sameDayConfirmedCount = await Appointment.countDocuments({
        doctor: doctor._id,

        appointmentDate: {
          $gte: dayStart,
          $lte: dayEnd,
        },

        status: "Confirmed",
      }).session(session);

      appointment.tokenNumber = sameDayConfirmedCount + 1;

      // ✅ Online Consultation
      if (appointment.consultationType === "Online") {
        appointment.videoCallEnabled = true;

        if (!appointment.videoCallRoomId) {
          appointment.videoCallRoomId = uuidv4();
        }

        appointment.videoCallStatus = "ready";
      }
    }

    // ✅ Cancelled
    if (status === "Cancelled") {
      appointment.status = "Cancelled";
      await DoctorSchedule.updateOne(
        { doctor: appointment.doctor, date: appointment.appointmentDate },
        {
          $set: {
            "slots.$[elem].isBooked": false,

            "slots.$[elem].bookingStatus": "Available",
          },
        },
        {
          arrayFilters: [
            {
              "elem.start": appointment.timeSlot.start,
              "elem.end": appointment.timeSlot.end,
            },
          ],
        },
      ).session(session);

      appointment.cancellationReason = notes || "Cancelled by doctor";
      appointment.cancelledBy = "Doctor";
    }

    // ✅ With-Doctor
    // ✅ With-Doctor
    if (status === "With-Doctor") {
      appointment.status = "With-Doctor";
      appointment.startedAt = new Date();

      // 🎥 activate video call
      if (appointment.consultationType === "Online") {
        appointment.videoCallStatus = "active";
      }

      if (notes) appointment.notes = notes;

      await appointment.save({ session });
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Appointment started",
        appointment,
      });
    }

    // ✅ Completed
    if (status === "Completed") {
      appointment.status = "Completed";
      appointment.completedAt = new Date();

      // 🎥 end video call
      if (appointment.consultationType === "Online") {
        appointment.videoCallStatus = "ended";
      }

      if (notes) appointment.notes = notes;
    }

    await appointment.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: `Appointment ${status} successfully`,
      appointment,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("updateAppointmentStatus:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------- Start Consultation (alias for With-Doctor) -----------------
export const startConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const { doctorId } = req.user._id;
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointmentId" });

    const doctor = await doctorModel.findOne(doctorId);
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment)
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });

    if (appointment.doctor.toString() !== doctor._id.toString())
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    appointment.status = "With-Doctor";
    appointment.startedAt = new Date();
    await appointment.save();

    return res
      .status(200)
      .json({ success: true, message: "Consultation started", appointment });
  } catch (err) {
    console.error("startConsultation:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------- Reschedule Appointment (Doctor / Receptionist) -----------------
export const rescheduleByDoctor = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    let { appointmentDate, timeSlot } = req.body;
    const doctorUserId = req.user._id;

    if (!isValidObjectId(appointmentId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointment id" });

    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment)
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });

    if (
      appointment.doctor.toString() !== doctor._id.toString() &&
      req.user.role !== "receptionist" &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to reschedule" });
    }

    // find available slots for new date
    if (!appointmentDate || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: "appointmentDate and timeSlot are required",
      });
    }

    const schedule = await DoctorSchedule.findOne({
      doctor: doctor._id,
      date: {
        $gte: moment.utc(appointmentDate).startOf("day").toDate(),
        $lte: moment.utc(appointmentDate).endOf("day").toDate(),
      },
    });

    if (!schedule)
      return res
        .status(404)
        .json({ success: false, message: "No schedule found for that date" });

    const slot = schedule.slots.find(
      (s) =>
        s.start === timeSlot.start && s.end === timeSlot.end && !s.isBooked,
    );
    if (!slot)
      return res
        .status(400)
        .json({ success: false, message: "Requested slot not available" });

    // free old slot
    const oldSchedule = await DoctorSchedule.findOne({
      doctor: appointment.doctor,
      date: {
        $gte: moment.utc(appointment.appointmentDate).startOf("day").toDate(),
        $lte: moment.utc(appointment.appointmentDate).endOf("day").toDate(),
      },
    });
    if (oldSchedule) {
      const idx = oldSchedule.slots.findIndex(
        (s) =>
          s.start === appointment.timeSlot.start &&
          s.end === appointment.timeSlot.end,
      );
      if (idx !== -1) {
        oldSchedule.slots[idx].isBooked = false;
        await oldSchedule.save();
      }
    }

    // book new slot
    const newIdx = schedule.slots.findIndex(
      (s) => s.start === timeSlot.start && s.end === timeSlot.end,
    );
    schedule.slots[newIdx].isBooked = true;
    await schedule.save();

    // update appointment
    appointment.appointmentDate = moment
      .utc(appointmentDate)
      .startOf("day")
      .toDate();
    appointment.timeSlot = { start: timeSlot.start, end: timeSlot.end };
    appointment.status = "Pending";
    await appointment.save();

    return res
      .status(200)
      .json({ success: true, message: "Appointment rescheduled", appointment });
  } catch (err) {
    console.error("rescheduleByDoctor:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getDoctorAnalytics = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const now = moment.utc();
    const startOfMonth = now.clone().startOf("month").toDate();
    const startOfYear = now.clone().startOf("year").toDate();

    const totalAppointments = await Appointment.countDocuments({
      doctor: doctor._id,
    });
    const completed = await Appointment.countDocuments({
      doctor: doctor._id,
      status: "Completed",
    });
    const cancelled = await Appointment.countDocuments({
      doctor: doctor._id,
      status: "Cancelled",
    });
    const upcoming = await Appointment.countDocuments({
      doctor: doctor._id,
      appointmentDate: { $gte: new Date() },
      status: { $ne: "Cancelled" },
    });

    // revenue from payments (sum)
    const payments = await Payment.find({
      appointment: {
        $in: await Appointment.find({ doctor: doctor._id }).distinct("_id"),
      },
      status: "Paid",
    }).select("amount");
    const totalRevenue = payments.reduce((s, p) => s + (p.amount || 0), 0);

    // monthly counts for last 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = now
        .clone()
        .subtract(i, "months")
        .startOf("month")
        .toDate();
      const mEnd = now.clone().subtract(i, "months").endOf("month").toDate();
      const count = await Appointment.countDocuments({
        doctor: doctor._id,
        appointmentDate: { $gte: mStart, $lte: mEnd },
      });
      months.push({ month: moment(mStart).format("MMM YYYY"), count });
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalAppointments,
        completed,
        cancelled,
        upcoming,
        totalRevenue,
        monthly: months,
      },
    });
  } catch (err) {
    console.error("getDoctorAnalytics:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------- End Consultation -----------------
export const endConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const doctorUserId = req.user._id;

    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointmentId" });

    // find doctor
    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    // find appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment)
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });

    // verify doctor owns appointment
    if (appointment.doctor.toString() !== doctor._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // must have medical record
    const medicalRecord = await MedicalRecord.findOne({
      appointment: appointmentId,
    });
    if (!medicalRecord)
      return res.status(400).json({
        success: false,
        message: "Cannot end consultation without medical record",
      });

    // optional: ensure at least 1 prescription
    // const prescriptionCount = await Prescription.countDocuments({ appointment: appointmentId });
    // if (prescriptionCount === 0)
    //   return res.status(400).json({
    //     success: false,
    //     message: "Add at least one prescription before ending consultation",
    //   });

    // update appointment
    appointment.status = "Completed";
    appointment.completedAt = new Date();
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Consultation ended successfully",
      appointment,
      medicalRecord,
    });
  } catch (err) {
    console.error("endConsultation:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------- Create Next Visit Appointment -----------------

export const createNextVisitAppointment = async (req, res) => {
  try {
    const doctorUserId = req.user._id;
    const { patientId, appointmentDate, timeSlot, consultationType, amount } =
      req.body;

    // validate
    if (!patientId || !isValidObjectId(patientId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid patientId" });

    if (!appointmentDate || !timeSlot)
      return res.status(400).json({
        success: false,
        message: "appointmentDate and timeSlot are required",
      });

    if (!consultationType || !["Online", "Offline"].includes(consultationType))
      return res.status(400).json({
        success: false,
        message: "consultationType must be 'Online' or 'Offline'",
      });

    const doctor = await doctorModel.findOne({ userId: doctorUserId });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const patient = await userModel.findById(patientId);
    if (!patient)
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });

    // find schedule for new date
    const schedule = await DoctorSchedule.findOne({
      doctor: doctor._id,
      date: {
        $gte: moment.utc(appointmentDate).startOf("day").toDate(),
        $lte: moment.utc(appointmentDate).endOf("day").toDate(),
      },
    });

    if (!schedule)
      return res.status(404).json({
        success: false,
        message: "No schedule found for that date",
      });

    // find slot and verify it's available
    const slot = schedule.slots.find(
      (s) =>
        s.start === timeSlot.start && s.end === timeSlot.end && !s.isBooked,
    );

    if (!slot)
      return res
        .status(400)
        .json({ success: false, message: "Requested time slot not available" });

    // mark slot booked
    const slotIndex = schedule.slots.findIndex(
      (s) => s.start === timeSlot.start && s.end === timeSlot.end,
    );
    schedule.slots[slotIndex].isBooked = true;
    await schedule.save();

    // create new appointment with Confirmed status
    const newAppointment = await Appointment.create({
      patient: patientId,
      doctor: doctor._id,
      appointmentDate: moment.utc(appointmentDate).startOf("day").toDate(),
      timeSlot: {
        start: timeSlot.start,
        end: timeSlot.end,
      },
      consultationType,
      status: "Confirmed",
      nextVisit: true,
    });

    // create payment record
    const payment = await Payment.create({
      appointment: newAppointment._id,
      patient: patientId,
      doctor: doctor._id,
      amount: amount || 0, // set default 0 if not provided
      status: "Paid", // or "Pending" if you want online payment later
      method: consultationType === "Online" ? "Online" : "Cash",
    });

    // attach payment to appointment
    newAppointment.payments = payment._id;
    await newAppointment.save();

    return res.status(201).json({
      success: true,
      message: "Next visit appointment created and confirmed",
      appointment: newAppointment,
      payment,
    });
  } catch (err) {
    console.error("createNextVisitAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
export const getPendingAppointments = async (req, res) => {
  try {
    const doctorUserId = req.user._id;

    const doctor = await doctorModel.findOne({
      userId: doctorUserId,
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Pagination
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Total Count
    const total = await Appointment.countDocuments({
      doctor: doctor._id,
      status: "Pending",
    });

    // Fetch Pending Appointments
    const pendingAppointments = await Appointment.find({
      doctor: doctor._id,
      status: "Pending",
    })
      .populate(
        "patient",
        `
        fullName
        profileImage
        patientId
        age
        gender
        contact
        `,
      )
      .sort({
        appointmentDate: 1,
        "timeSlot.start": 1,
      })
      .skip(skip)
      .limit(limit);

    // Format Response
    const formattedAppointments = pendingAppointments.map((appt) => ({
      appointmentId: appt._id,

      patient: {
        id: appt.patient?._id,
        fullName: appt.patient?.fullName || "Unknown Patient",
        profileImage: appt.patient?.profileImage || null,
        patientId: appt.patient?.patientId || "",
        age: appt.patient?.age || "",
        gender: appt.patient?.gender || "",
        contact: appt.patient?.contact || "",
      },

      appointmentDate: appt.appointmentDate,

      timeSlot: {
        start: appt.timeSlot?.start,
        end: appt.timeSlot?.end,
      },

      consultationType: appt.consultationType || "Offline",

      status: appt.status,

      reason: appt.reason || "",

      tokenNumber: appt.tokenNumber || null,

      createdAt: appt.createdAt,
    }));

    return res.status(200).json({
      success: true,

      page,

      limit,

      total,

      totalPages: Math.ceil(total / limit),

      count: formattedAppointments.length,

      appointments: formattedAppointments,
    });
  } catch (error) {
    console.error("getPendingAppointments:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
