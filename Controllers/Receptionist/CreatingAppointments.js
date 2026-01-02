import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import userModel from "../../Models/User/UserModels.js";
import Payment from "../../Models/Payments/paymentSchema.js";

// -----------------------------------------------------
// 📌 CREATE APPOINTMENT (Online/Offline + New/Existing)

// -----------------------------------------------------
export const createAppointment = async (req, res) => {
  try {
    const {
      patient,
      doctor,
      appointmentDate,
      timeSlot,
      consultationType,
      createdBy,
      receptionist,
      reason,
      isFollowUp,
    } = req.body;

    // Check if doctor exists
    const doctorExists = await doctorModel.findById(doctor);
    if (!doctorExists) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Check if patient exists
    const patientExists = await userModel.findById(patient);
    if (!patientExists) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Check doctor schedule for date
    const schedule = await DoctorSchedule.findOne({
      doctor,
      date: new Date(appointmentDate),
    });

    if (!schedule) {
      return res
        .status(400)
        .json({ message: "Doctor not available this date" });
    }

    // Check if slot exists in doctor schedule
    const slot = schedule.slots.find(
      (s) => s.start === timeSlot.start && s.end === timeSlot.end
    );

    if (!slot) {
      return res.status(400).json({ message: "Invalid time slot" });
    }

    // Slot already booked?
    if (slot.isBooked) {
      return res.status(400).json({ message: "Slot already booked" });
    }

    // Create appointment
    const newAppointment = await Appointment.create({
      patient,
      doctor,
      appointmentDate,
      timeSlot,
      consultationType,
      createdBy,
      receptionist,
      reason,
      isFollowUp,
      status: "Confirmed",
    });

    // Mark slot as booked
    slot.isBooked = true;
    await schedule.save();

    res.status(201).json({
      message: "Appointment created successfully",
      appointment: newAppointment,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------
// 📌 GET ALL APPOINTMENTS (Filter optional)
// -----------------------------------------------------
export const getAllAppointments = async (req, res) => {
  try {
    const { status, doctor, patient, date } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (doctor) filter.doctor = doctor;
    if (patient) filter.patient = patient;
    if (date) filter.appointmentDate = new Date(date);

    const appointments = await Appointment.find(filter)
      .populate({
        path: "patient",
        select: "fullName email contact patientId profileImage",
      })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName email profileImage",
          },
          {
            path: "department",
            select: "name description",
          },
        ],
      })
      .populate("receptionist")
      .sort({ appointmentDate: 1 });

    res.status(200).json({ appointments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------
// 📌 GET APPOINTMENT BY ID
// -----------------------------------------------------
export const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id).populate(
      "patient doctor receptionist payments"
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.status(200).json({ appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------
// 📌 UPDATE APPOINTMENT (Status/Notes/Payment)
// -----------------------------------------------------
export const updateAppointment = async (req, res) => {
  try {
    const updated = await Appointment.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );

    res
      .status(200)
      .json({ message: "Updated successfully", appointment: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------
// 📌 RESCHEDULE APPOINTMENT
// -----------------------------------------------------
export const rescheduleAppointment = async (req, res) => {
  try {
    const { newDate, newSlot } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Not found" });

    // Check new slot availability
    const schedule = await DoctorSchedule.findOne({
      doctor: appointment.doctor,
      date: new Date(newDate),
    });

    if (!schedule) {
      return res
        .status(400)
        .json({ message: "Doctor not available on new date" });
    }

    const slot = schedule.slots.find(
      (s) => s.start === newSlot.start && s.end === newSlot.end
    );

    if (!slot || slot.isBooked) {
      return res.status(400).json({ message: "Slot not available" });
    }

    // Update appointment
    appointment.appointmentDate = newDate;
    appointment.timeSlot = newSlot;
    appointment.status = "Confirmed";
    await appointment.save();

    // Mark new slot booked
    slot.isBooked = true;
    await schedule.save();

    res.status(200).json({ message: "Rescheduled", appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------
// 📌 CANCEL APPOINTMENT
// -----------------------------------------------------
export const cancelAppointment = async (req, res) => {
  try {
    const { reason } = req.body;

    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: "Cancelled", reason },
      { new: true }
    );

    res.status(200).json({ message: "Appointment cancelled", appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------
// 📌 TODAY APPOINTMENTS
// -----------------------------------------------------
export const getTodayAppointments = async (req, res) => {
  try {
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    let tomorrow = new Date();
    tomorrow.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      appointmentDate: { $gte: today, $lte: tomorrow },
    })
      .populate({
        path: "patient",
        select: "fullName email contact patientId profileImage",
      })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName email profileImage",
          },
          {
            path: "department",
            select: "name description",
          },
        ],
      });

    res.status(200).json({ appointments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------
// 📌 DOCTOR NEXT UPCOMING APPOINTMENTS
// -----------------------------------------------------
export const getDoctorNextAppointments = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const upcoming = await Appointment.find({
      doctor: doctorId,
      appointmentDate: { $gte: new Date() },
      status: { $nin: ["Cancelled", "Completed", "Missed"] },
    })
      .sort({ appointmentDate: 1 })
      .limit(10)
      .populate("patient doctor");

    res.status(200).json({ upcoming });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 GET ALL APPOINTMENTS BY DEPARTMENT
export const getAppointmentsByDepartment = async (req, res) => {
  try {
    const { department } = req.query;

    if (!department) {
      return res.status(400).json({ message: "Department is required" });
    }

    // Find doctors in this department
    const doctors = await doctorModel.find({ department });

    if (doctors.length === 0) {
      return res
        .status(404)
        .json({ message: "No doctors found in this department" });
    }

    const doctorIds = doctors.map((d) => d._id);

    // Find appointments linked to these doctors
    const appointments = await Appointment.find({
      doctor: { $in: doctorIds },
    })
      .populate("doctor patient receptionist")
      .sort({ appointmentDate: 1 });

    res.status(200).json({
      department,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// -----------------------------------------------------
// 📌 GET ALL APPOINTMENTS FOR A SPECIFIC DOCTOR
// -----------------------------------------------------
export const getAppointmentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Check if doctor exists
    const doctorExists = await doctorModel.findById(doctorId);
    if (!doctorExists) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Fetch appointments
    const appointments = await Appointment.find({ doctor: doctorId })
      .populate("patient receptionist")
      .sort({ appointmentDate: 1 });

    res.status(200).json({
      doctor: doctorExists.name || doctorExists._id,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------
// 📌 CREATE APPOINTMENT WITH PAYMENT
// -----------------------------------------------------
export const createAppointmentWithPayment = async (req, res) => {
  try {
    const {
      patient,
      doctor,
      appointmentDate,
      timeSlot,
      consultationType,
      reason,
      isFollowUp,
      payment,
    } = req.body;

    const receptionist = req.user?._id || req.user?.id;
    if (!receptionist) {
      return res
        .status(401)
        .json({ success: false, message: "Receptionist not authenticated" });
    }


    const doctorExists = await doctorModel.findById(doctor);
    if (!doctorExists) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    // Check if patient exists
    const patientExists = await userModel.findById(patient);
    if (!patientExists) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    // Normalize date to start/end of day for comparison
    const appointmentDateObj = new Date(appointmentDate);
    if (isNaN(appointmentDateObj.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointment date format" });
    }

    const scheduleDateStart = new Date(appointmentDateObj);
    scheduleDateStart.setHours(0, 0, 0, 0);

    const scheduleDateEnd = new Date(appointmentDateObj);
    scheduleDateEnd.setHours(23, 59, 59, 999);

    // Try to find schedule - first try exact date match, then date range
    let schedule = await DoctorSchedule.findOne({
      doctor,
      date: scheduleDateStart,
    });

    // If not found with exact match, try date range query
    if (!schedule) {
      schedule = await DoctorSchedule.findOne({
        doctor,
        date: {
          $gte: scheduleDateStart,
          $lte: scheduleDateEnd,
        },
      });
    }

    // If still not found, try with the original appointmentDate (in case schedule uses different format)
    if (!schedule) {
      schedule = await DoctorSchedule.findOne({
        doctor,
        date: appointmentDateObj,
      });
    }

    if (!schedule) {
      console.error("Schedule not found for:", {
        doctor,
        appointmentDate,
        scheduleDateStart,
        scheduleDateEnd,
      });
      return res.status(400).json({
        success: false,
        message: `Doctor not available on ${new Date(
          appointmentDate
        ).toLocaleDateString()}. Please check doctor schedule.`,
      });
    }

    // Generate slots if empty
    if (!schedule.slots || schedule.slots.length === 0) {
      // If slots are empty, we can't book - schedule needs to have slots
      return res.status(400).json({
        success: false,
        message: "Doctor schedule has no available slots for this date",
      });
    }

    // Normalize time format for comparison (handle both "09:00 AM" and "09:00" formats)
    const normalizeTime = (time) => {
      if (!time) return "";
      // Remove extra spaces and convert to uppercase for comparison
      return time.trim().toUpperCase().replace(/\s+/g, " ");
    };

    // Check if slot exists in doctor schedule
    const requestedStart = normalizeTime(timeSlot.start);
    const requestedEnd = normalizeTime(timeSlot.end);

    const slot = schedule.slots.find(
      (s) =>
        normalizeTime(s.start) === requestedStart &&
        normalizeTime(s.end) === requestedEnd
    );

    if (!slot) {
      const availableSlots = schedule.slots
        .filter((s) => !s.isBooked)
        .map((s) => `${s.start}-${s.end}`)
        .join(", ");
      console.error("Slot not found:", {
        requestedSlot: timeSlot,
        normalizedRequested: { start: requestedStart, end: requestedEnd },
        availableSlots: schedule.slots.map((s) => ({
          start: s.start,
          end: s.end,
          normalized: {
            start: normalizeTime(s.start),
            end: normalizeTime(s.end),
          },
          isBooked: s.isBooked,
        })),
      });
      return res.status(400).json({
        success: false,
        message: `Invalid time slot (${timeSlot.start}-${
          timeSlot.end
        }). Available slots: ${availableSlots || "None"}`,
      });
    }

    // Slot already booked?
    if (slot.isBooked) {
      return res
        .status(400)
        .json({ success: false, message: "Slot already booked" });
    }

    // Create appointment - ensure appointmentDate is a Date object
    const newAppointment = await Appointment.create({
      patient,
      doctor,
      appointmentDate: appointmentDateObj, // Use the Date object, not ISO string
      timeSlot: {
        start: timeSlot.start,
        end: timeSlot.end,
      },
      consultationType: consultationType || "Offline",
      receptionist,
      reason: reason || "General Consultation",
      isFollowUp: isFollowUp || false,
      status: "Confirmed",
      paymentStatus: "Paid",
    });

    // Mark slot as booked
    slot.isBooked = true;
    await schedule.save();

    // Create payment record
    let paymentRecord = null;
    if (payment) {
      // Validate payment method
      const validMethods = ["UPI", "Card", "Cash", "NetBanking"];
      const paymentMethod = payment.method || "Cash";

      if (!validMethods.includes(paymentMethod)) {
        // If invalid method, default to Cash
        payment.method = "Cash";
      }

      // Validate amount
      const paymentAmount = parseFloat(payment.amount) || 0;
      if (paymentAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "Payment amount cannot be negative",
        });
      }

      paymentRecord = await Payment.create({
        appointment: newAppointment._id,
        patient,
        method: paymentMethod,
        channel: payment.channel || "WalkIn",
        amount: paymentAmount,
        type: payment.type || "Initial",
        status: payment.status || "Paid",
      });

      // Link payment to appointment
      newAppointment.payments = [paymentRecord._id];
      await newAppointment.save();
    }

    // Populate appointment data
    const populatedAppointment = await Appointment.findById(
      newAppointment._id
    ).populate("patient doctor receptionist");

    res.status(201).json({
      success: true,
      message: "Appointment created successfully with payment",
      data: {
        appointment: populatedAppointment,
        payment: paymentRecord,
      },
    });
  } catch (error) {
    console.error("Create appointment with payment error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create appointment with payment",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};         
