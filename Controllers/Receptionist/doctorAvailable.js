import moment from "moment";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";

// --------------------
// Helper: normalize date to start/end of day
// --------------------
const getDateRange = (date) => {
  const start = moment(date).startOf("day").toDate();
  const end = moment(date).endOf("day").toDate();
  return { start, end };
};

// --------------------
// Helper: Generate slots from working hours & breaks
// --------------------
const generateSlots = (workingHours, breaks = [], slotDuration = 30) => {
  const slots = [];
  let current = moment(workingHours.start, "hh:mm A");
  const end = moment(workingHours.end, "hh:mm A");

  while (current.add(0, "minutes").isBefore(end)) {
    const slotStart = current.clone();
    const slotEnd = current.clone().add(slotDuration, "minutes");

    // Skip if overlaps with a break
    const isBreak = breaks.some(b => {
      const breakStart = moment(b.start, "hh:mm A");
      const breakEnd = moment(b.end, "hh:mm A");
      return slotStart.isBefore(breakEnd) && slotEnd.isAfter(breakStart);
    });

    if (!isBreak && slotEnd.isSameOrBefore(end)) {
      slots.push({ start: slotStart.format("hh:mm A"), end: slotEnd.format("hh:mm A"), isBooked: false });
    }

    current.add(slotDuration, "minutes");
  }

  return slots;
};

// --------------------
// 1️⃣ Check if doctor is generally available
// --------------------
export const isDoctorAvailable = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await doctorModel.findById(id);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    res.status(200).json({
      available: doctor.status === "available",
      message: doctor.status === "available" ? "Doctor is available" : "Doctor unavailable",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --------------------
// 2️⃣ Check if doctor is available on a specific day
// --------------------
export const doctorAvailableOnDay = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { day } = req.query;
    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    const isAvailable = doctor.availableDays.map(d => d.toLowerCase()).includes(day.toLowerCase());
    res.status(200).json({
      doctor: doctorId,
      day,
      available: isAvailable,
      message: isAvailable ? "Doctor is available on selected day" : "Doctor is not available on this day",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --------------------
// 3️⃣ Check if doctor is available on a specific date
// --------------------
export const doctorAvailableOnDate = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const { start, end } = getDateRange(date);

    const schedule = await DoctorSchedule.findOne({
      doctor: id,
      date: { $gte: start, $lt: end },
    });

    if (!schedule) {
      return res.status(200).json({
        available: false,
        message: "Doctor not available on this date",
      });
    }

    res.status(200).json({
      available: true,
      message: "Doctor is available on this date",
      workingHours: schedule.workingHours,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --------------------
// 4️⃣ Get all available slots for a specific date
// --------------------
export const getDoctorAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;
    const { start, end } = getDateRange(date);

    const schedule = await DoctorSchedule.findOne({
      doctor: doctorId,
      date: { $gte: start, $lt: end },
    });

    if (!schedule) return res.status(404).json({ message: "Doctor schedule not found for this date" });

    // Generate slots if empty
    if (!schedule.slots || schedule.slots.length === 0) {
      schedule.slots = generateSlots(schedule.workingHours, schedule.breaks);
    }

    const availableSlots = schedule.slots.filter(slot => !slot.isBooked);

    res.status(200).json({
      success: true,
      doctor: doctorId,
      date,
      workingHours: schedule.workingHours,
      availableSlots,
      totalAvailableSlots: availableSlots.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --------------------
// 5️⃣ Check if a specific slot is available
// --------------------
export const checkSlotAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, start, end } = req.query;
    const { start: dayStart, end: dayEnd } = getDateRange(date);

    const schedule = await DoctorSchedule.findOne({
      doctor: doctorId,
      date: { $gte: dayStart, $lt: dayEnd },
    });

    if (!schedule) return res.status(404).json({ message: "No schedule for this date" });

    // Generate slots if empty
    if (!schedule.slots || schedule.slots.length === 0) {
      schedule.slots = generateSlots(schedule.workingHours, schedule.breaks);
    }

    const slot = schedule.slots.find(s => s.start === start && s.end === end);
    if (!slot) return res.status(400).json({ message: "Invalid slot" });

    res.status(200).json({
      available: !slot.isBooked,
      message: slot.isBooked ? "Slot already booked" : "Slot is available",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --------------------
// 6️⃣ Get all available dates for a doctor
// --------------------
export const getDoctorAvailableDates = async (req, res) => {
  try {
    const { id: doctorId } = req.params;

    const schedules = await DoctorSchedule.find({ doctor: doctorId });
    if (!schedules.length) return res.status(404).json({ message: "No schedules found for this doctor" });

    const availableDates = schedules
      .filter(sch => {
        if (!sch.slots || sch.slots.length === 0) {
          sch.slots = generateSlots(sch.workingHours, sch.breaks);
        }
        return sch.slots.some(slot => !slot.isBooked);
      })
      .map(sch => sch.date)
      .sort((a, b) => new Date(a) - new Date(b));

    if (!availableDates.length) return res.status(404).json({ message: "No available dates found for this doctor" });

    res.status(200).json({
      doctor: doctorId,
      availableDates,
      totalDates: availableDates.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

  // --------------------
  // 7️⃣ Get all doctors available on a specific date
  // --------------------
  export const getDoctorsAvailableOnDate = async (req, res) => {
    try {
      const { date } = req.query;
      const { start, end } = getDateRange(date);

      const schedules = await DoctorSchedule.find({
        date: { $gte: start, $lt: end },
      }).populate("doctor");

      if (!schedules.length) {
        return res.status(200).json({ availableDoctors: [], message: "No doctors available on this date" });
      }

      const availableDoctors = schedules
        .filter(sch => {
          if (!sch.slots || sch.slots.length === 0) {
            sch.slots = generateSlots(sch.workingHours, sch.breaks);
          }
          return sch.slots.some(slot => !slot.isBooked);
        })
        .map(sch => sch.doctor);

      // Remove duplicates
      const uniqueDoctors = [...new Map(availableDoctors.map(doc => [doc._id.toString(), doc])).values()];

      res.status(200).json({
        date,
        availableDoctors: uniqueDoctors,
        totalDoctors: uniqueDoctors.length,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // --------------------
// 8️⃣ Get all doctors available TODAY
// --------------------
export const getDoctorsAvailableToday = async (req, res) => {
  try {
    // Get today's start and end timestamps
    const today = new Date();
    const { start, end } = {
      start: moment(today).startOf("day").toDate(),
      end: moment(today).endOf("day").toDate(),
    };

    // Find schedules for today
    const schedules = await DoctorSchedule.find({
      date: { $gte: start, $lt: end },
    }).populate("doctor");

    if (!schedules.length) {
      return res.status(200).json({
        availableDoctors: [],
        message: "No doctors available today",
      });
    }

    const availableDoctors = schedules
      .map(schedule => {
        // Generate slots if empty
        if (!schedule.slots || schedule.slots.length === 0) {
          schedule.slots = generateSlots(schedule.workingHours, schedule.breaks);
        }

        // Check if any slot is free
        const hasAvailableSlot = schedule.slots.some(slot => !slot.isBooked);

        return hasAvailableSlot ? schedule.doctor : null;
      })
      .filter(Boolean); // remove nulls

    // Unique doctors
    const uniqueDoctors = [
      ...new Map(
        availableDoctors.map(doc => [doc._id.toString(), doc])
      ).values(),
    ];

    res.status(200).json({
      date: moment(today).format("YYYY-MM-DD"),
      availableDoctors: uniqueDoctors,
      totalDoctors: uniqueDoctors.length,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
