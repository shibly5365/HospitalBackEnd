import moment from "moment";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import holidaySchema from "../../Models/LeaveRequest/holidaySchema.js";
import DoctorLeave from "../../Models/LeaveRequest/leaveSchema.js";

// ================= SLOT GENERATOR =================

// slot generator
// SLOT GENERATOR FUNCTION
export function generateSlots(
  start,
  end,
  duration = 30,
  breaks = [],
  onlineFee = 100,
  offlineFee = 80,
) {
  const slots = [];
  let current = moment(start, "HH:mm");
  const endTime = moment(end, "HH:mm");

  while (current.clone().add(duration, "minutes").isSameOrBefore(endTime)) {
    const slotStart = current.clone();
    const slotEnd = current.clone().add(duration, "minutes");

    const isBreak = breaks.some((b) => {
      const bStart = moment(b.start, "HH:mm");
      const bEnd = moment(b.end, "HH:mm");

      return slotStart.isBefore(bEnd) && slotEnd.isAfter(bStart);
    });

    if (!isBreak) {
      slots.push({
        start: slotStart.format("HH:mm"),
        end: slotEnd.format("HH:mm"),
        duration,
        isBooked: false,
        onlineFee,
        offlineFee,
      });
    }

    current.add(duration, "minutes");
  }

  return slots;
}

export const createSchedule = async (req, res) => {
  try {
    let {
      doctorId,
      weekDays = [],
      weeksAhead = 4,
      selectedDates = [],
      workingHours,
      preset = "custom",
      slotDuration = 30,
      breaks = [],
      onlineFee = 100,
      offlineFee = 80,
    } = req.body;

    // -----------------------------------
    // AUTO BIND DOCTOR
    // -----------------------------------
    if (req.user.role === "doctor") {
      const doctor = await doctorModel.findOne({ userId: req.user._id });

      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: "Doctor not found",
        });
      }

      doctorId = doctor._id;
    }

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "doctorId required",
      });
    }

    // -----------------------------------
    // PRESETS
    // -----------------------------------
    const PRESETS = {
      morning: { start: "08:00", end: "12:00" },
      afternoon: { start: "13:00", end: "17:00" },
      evening: { start: "17:00", end: "21:00" },
      "full-day": { start: "09:00", end: "18:00" },
    };

    if (preset !== "custom" && PRESETS[preset]) {
      workingHours = PRESETS[preset];
    }

    // -----------------------------------
    // VALIDATION
    // -----------------------------------
    if (!workingHours?.start || !workingHours?.end) {
      return res.status(400).json({
        success: false,
        message: "Working hours missing",
      });
    }

    if (
      moment(workingHours.end, "HH:mm").isSameOrBefore(
        moment(workingHours.start, "HH:mm"),
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    // Validate breaks
    for (const b of breaks) {
      if (moment(b.end, "HH:mm").isSameOrBefore(moment(b.start, "HH:mm"))) {
        return res.status(400).json({
          success: false,
          message: "Invalid break time",
        });
      }
    }

    const today = moment().startOf("day");
    const createdSchedules = [];

    // -----------------------------------
    // SLOT GENERATOR
    // -----------------------------------
    const generateDoctorSlots = () =>
      generateSlots(
        workingHours.start,
        workingHours.end,
        slotDuration,
        breaks,
        onlineFee,
        offlineFee,
      );

    // -----------------------------------
    // 1. SINGLE DATE SCHEDULE
    // -----------------------------------
    if (selectedDates.length) {
      for (const d of selectedDates) {
        const date = moment(d, "YYYY-MM-DD").startOf("day");

        if (date.isBefore(today)) continue;

        const exists = await DoctorSchedule.findOne({
          doctor: doctorId,
          date: date.toDate(),
        });

        if (exists) continue;

        const schedule = await DoctorSchedule.create({
          doctor: doctorId,
          date: date.toDate(),
          dayName: date.format("dddd"),
          workingHours,
          preset,
          slotDuration,
          breaks,
          slots: generateDoctorSlots(),
        });

        createdSchedules.push(schedule);
      }
    }

    // -----------------------------------
    // 2. WEEKLY RECURRING SCHEDULE
    // -----------------------------------
    if (weekDays.length) {
      for (let i = 0; i < weeksAhead; i++) {
        for (const day of weekDays) {
          let date = today.clone().add(i, "weeks").day(day);

          if (date.isBefore(today)) {
            date.add(1, "week");
          }

          const exists = await DoctorSchedule.findOne({
            doctor: doctorId,
            date: date.toDate(),
          });

          if (exists) continue;

          const schedule = await DoctorSchedule.create({
            doctor: doctorId,
            date: date.toDate(),
            dayName: date.format("dddd"),
            workingHours,
            preset,
            slotDuration,
            breaks,
            slots: generateDoctorSlots(),
          });

          createdSchedules.push(schedule);
        }
      }
    }

    // -----------------------------------
    // RESPONSE
    // -----------------------------------
    return res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      count: createdSchedules.length,
      schedules: createdSchedules,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getAllSchedules = async (req, res) => {
  try {
    const { doctorId } = req.query;

    const filter = doctorId
      ? { doctor: doctorId, date: { $gte: new Date() } }
      : {};

    const schedules = await DoctorSchedule.find(filter)
      .populate("doctor", "specialization qualification")
      .sort({ date: 1 });

    res.json({ success: true, schedules });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDoctorSchedules = async (req, res) => {
  try {
    // Find doctor profile using the logged-in userId
    const doctor = await doctorModel.findOne({ userId: req.user._id });

    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    const schedules = await DoctorSchedule.find({
      doctor: doctor._id, // <-- FIXED
      date: { $gte: new Date() },
    })
      .populate("doctor", "name specialization qualification")
      .sort({ date: 1 });

    res.json({
      success: true,
      count: schedules.length,
      schedules,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDoctorScheduleById = async (req, res) => {
  try {
    const doctorId = req.params.id;
    const { date } = req.query;

    if (!doctorId)
      return res.status(400).json({ message: "doctorId required" });

    const filter = { doctor: doctorId };

    if (date) {
      const d = moment(date, "YYYY-MM-DD");
      filter.date = {
        $gte: d.startOf("day").toDate(),
        $lte: d.endOf("day").toDate(),
      };
    }

    const schedules = await DoctorSchedule.find(filter).sort({ date: 1 });

    res.json({ success: true, schedules });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const {
      workingHours,
      breaks,
      date,
      slotDuration,
      preset = "custom",
      slots, // optional manual override
    } = req.body;

    const schedule = await DoctorSchedule.findById(scheduleId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    // -----------------------------------
    // UPDATE DATE
    // -----------------------------------
    if (date) {
      const d = moment(date, "YYYY-MM-DD").startOf("day");

      schedule.date = d.toDate();
      schedule.dayName = d.format("dddd");
    }

    // -----------------------------------
    // PRESETS
    // -----------------------------------
    const PRESETS = {
      morning: { start: "08:00", end: "12:00" },
      afternoon: { start: "13:00", end: "17:00" },
      evening: { start: "17:00", end: "21:00" },
      "full-day": { start: "09:00", end: "18:00" },
    };

    let finalWorkingHours = workingHours || schedule.workingHours;

    if (preset !== "custom" && PRESETS[preset]) {
      finalWorkingHours = PRESETS[preset];
      schedule.preset = preset;
    }

    // -----------------------------------
    // VALIDATION
    // -----------------------------------
    if (
      moment(finalWorkingHours.end, "HH:mm").isSameOrBefore(
        moment(finalWorkingHours.start, "HH:mm")
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    if (breaks) {
      for (const b of breaks) {
        if (
          moment(b.end, "HH:mm").isSameOrBefore(
            moment(b.start, "HH:mm")
          )
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid break time",
          });
        }
      }
      schedule.breaks = breaks;
    }

    // -----------------------------------
    // APPLY UPDATES
    // -----------------------------------
    if (workingHours || preset !== "custom") {
      schedule.workingHours = finalWorkingHours;
    }

    if (slotDuration) {
      schedule.slotDuration = slotDuration;
    }

    // -----------------------------------
    // REGENERATE SLOTS (SAFE)
    // -----------------------------------
    if (workingHours || breaks || slotDuration || preset !== "custom") {
      const newSlots = generateSlots(
        schedule.workingHours.start,
        schedule.workingHours.end,
        schedule.slotDuration,
        schedule.breaks
      );

      // ⚠️ Preserve booked slots
      const bookedMap = new Map(
        schedule.slots
          .filter((s) => s.isBooked)
          .map((s) => [s.start + "-" + s.end, s])
      );

      schedule.slots = newSlots.map((slot) => {
        const key = slot.start + "-" + slot.end;

        if (bookedMap.has(key)) {
          return {
            ...slot,
            isBooked: true,
          };
        }

        return slot;
      });
    }

    // -----------------------------------
    // MANUAL SLOT OVERRIDE (OPTIONAL)
    // -----------------------------------
    if (slots) {
      schedule.slots = slots;
    }

    await schedule.save();

    res.json({
      success: true,
      message: "Schedule updated",
      schedule,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await DoctorSchedule.findById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    // ⚠️ Prevent delete if booked slots exist (important)
    const hasBookings = schedule.slots.some((s) => s.isBooked);

    if (hasBookings) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete schedule with booked slots",
      });
    }

    await schedule.deleteOne();

    res.json({
      success: true,
      message: "Schedule deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const doctorWorkingDays = async (req, res) => {
  try {
    const doctorId = req.user._id;

    // 📅 Month range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const today = new Date();

    // ================================
    // ✅ 1. TOTAL WORKING DAYS
    // ================================
    const totalWorkingDays = await DoctorSchedule.countDocuments({
      doctor: doctorId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      isLeaveDay: false,
    });

    // ================================
    // ✅ 2. UPCOMING SHIFTS
    // ================================
    const upcomingShifts = await DoctorSchedule.countDocuments({
      doctor: doctorId,
      date: { $gt: today },
      isLeaveDay: false,
    });

    // ================================
    // ✅ 3. LEAVE DAYS
    // ================================
    const leaveDays = await DoctorSchedule.countDocuments({
      doctor: doctorId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      isLeaveDay: true,
    });

    // ================================
    // ✅ 4. HOLIDAYS
    // ================================
    const holidays = await holidaySchema.countDocuments({
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    // ================================
    // 🎯 FINAL RESPONSE
    // ================================
    res.json({
      totalWorkingDays,
      upcomingShifts,
      holidays,
      leaveDays,
    });
  } catch (error) {
    console.error("Working Days Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getDoctorAvailability = async (req, res) => {
  try {
    const doctor = await doctorModel.findOne({ userId: req.user._id });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // ✅ FIX: start from today (00:00)
    const today = moment().startOf("day").toDate();

    // ===============================
    // 1. GET SCHEDULES
    // ===============================
    const schedules = await DoctorSchedule.find({
      doctor: doctor._id,
      date: { $gte: today },
    }).sort({ date: 1 });

    const availableDays = schedules
      .filter((s) => !s.isLeaveDay)
      .map((s) => moment(s.date).startOf("day").format("YYYY-MM-DD"));

    // ===============================
    // 2. GET LEAVES
    // ===============================
    const leaves = await DoctorLeave.find({
      doctor: doctor._id,
    });

    let leaveDays = [];

    leaves.forEach((leave) => {
      const start = moment(leave.startDate);
      const end = moment(leave.endDate);

      // 🔥 Loop all days (important)
      while (start.isSameOrBefore(end)) {
        leaveDays.push({
          date: start.clone().startOf("day").format("YYYY-MM-DD"),
          status: leave.status,
        });

        start.add(1, "day");
      }
    });

    // ===============================
    // 3. REMOVE DUPLICATES
    // ===============================
    leaveDays = leaveDays.filter(
      (v, i, arr) => i === arr.findIndex((t) => t.date === v.date),
    );

    // ===============================
    // 4. RESPONSE
    // ===============================
    res.json({
      success: true,
      availableDays,
      leaveDays,
    });
  } catch (err) {
    console.error("Availability Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
