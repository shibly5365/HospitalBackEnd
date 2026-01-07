import moment from "moment";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
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
  offlineFee = 80
) {
  const slots = [];
  const current = moment.utc(start, "HH:mm");
  const endTime = moment.utc(end, "HH:mm");

  while (current.clone().add(duration, "minutes").isSameOrBefore(endTime)) {
    const slotStart = current.clone();
    const slotEnd = current.clone().add(duration, "minutes");

    // Check for break-time overlap
    const isBreak = breaks.some((b) => {
      const bStart = moment.utc(b.start, "HH:mm");
      const bEnd = moment.utc(b.end, "HH:mm");
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
      weekDays,
      weeksAhead = 4,
      selectedDates,
      workingHours,
      preset = "custom",
      slotDuration = 30,
      breaks = [],
      onlineFee = 100,
      offlineFee = 80,
    } = req.body;

    // -----------------------------------
    // Auto-bind doctor if logged in
    // -----------------------------------
    if (req.user.role === "doctor") {
      const doctor = await doctorModel.findOne({ userId: req.user._id });
      if (!doctor)
        return res
          .status(404)
          .json({ success: false, message: "Doctor not found" });

      doctorId = doctor._id;
    }

    if (!doctorId)
      return res
        .status(400)
        .json({ success: false, message: "doctorId required" });

    // -----------------------------------
    // Slot Presets
    // -----------------------------------
    const PRESETS = {
      morning: { start: "08:00", end: "12:00" },
      afternoon: { start: "13:00", end: "17:00" },
      evening: { start: "17:00", end: "21:00" },
      "full-day": { start: "09:00", end: "17:00" },
    };

    if (preset !== "custom" && PRESETS[preset]) {
      workingHours = PRESETS[preset];
    }

    if (!workingHours || !workingHours.start || !workingHours.end) {
      return res.status(400).json({
        success: false,
        message: "Working hours missing",
      });
    }

    const today = moment().startOf("day");
    const createdSchedules = [];

    // SLOT BUILDER
    const generateDoctorSlots = () =>
      generateSlots(
        workingHours.start,
        workingHours.end,
        slotDuration,
        breaks,
        onlineFee,
        offlineFee
      );

    // -----------------------------------
    // WEEKDAY RECURRING SCHEDULES
    // -----------------------------------
    if (weekDays?.length) {
      for (let i = 0; i < weeksAhead; i++) {
        for (const day of weekDays) {
          let date = today.clone().add(i, "weeks").day(day);

          if (date.isBefore(today)) date.add(1, "week");

          const exists = await DoctorSchedule.findOne({
            doctor: doctorId,
            date: date.toDate(),
          });

          if (exists) continue;

          const slots = generateDoctorSlots();

          const schedule = await DoctorSchedule.create({
            doctor: doctorId,
            date: date.toDate(),
            dayName: date.format("dddd"),
            workingHours,
            preset,
            slotDuration,
            breaks,
            onlineFee,
            offlineFee,
            slots,
          });

          createdSchedules.push(schedule);
        }
      }
    }

    // -----------------------------------
    // CUSTOM DATES
    // -----------------------------------
    if (selectedDates?.length) {
      for (const d of selectedDates) {
        const date = moment(d, "YYYY-MM-DD").startOf("day");

        const exists = await DoctorSchedule.findOne({
          doctor: doctorId,
          date: date.toDate(),
        });

        if (exists) continue;

        const slots = generateDoctorSlots();

        const schedule = await DoctorSchedule.create({
          doctor: doctorId,
          date: date.toDate(),
          dayName: date.format("dddd"),
          workingHours,
          preset,
          slotDuration,
          breaks,
          onlineFee,
          offlineFee,
          slots,
        });

        createdSchedules.push(schedule);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      schedules: createdSchedules,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
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
    const { slots, workingHours, breaks, date } = req.body;

    const schedule = await DoctorSchedule.findById(scheduleId);

    if (!schedule)
      return res.status(404).json({ message: "Schedule not found" });

    // Update date
    if (date) {
      const d = moment(date, "YYYY-MM-DD").startOf("day");
      schedule.date = d.toDate();
      schedule.dayName = d.format("dddd");
    }

    // Update hours
    if (workingHours) schedule.workingHours = workingHours;

    // Update breaks
    if (breaks) schedule.breaks = breaks;

    // Update slots
    if (workingHours || breaks) {
      schedule.slots = generateSlots(
        schedule.workingHours.start,
        schedule.workingHours.end,
        schedule.duration,
        schedule.breaks
      );
    }

    if (slots) schedule.slots = slots;

    await schedule.save();

    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteSchedule = async (req, res) => {
  try {
    await DoctorSchedule.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Schedule deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const doctorWorkingDays = async (req, res) => {
  try {
    const { doctorId, date, preset, customStart, customEnd, slotDuration, breaks } = req.body;

    // 1. Check leave
    const leave = await DoctorLeave.findOne({
      doctor: doctorId,
      startDate: { $lte: date },
      endDate: { $gte: date },
      status: "approved",
    });

    if (leave?.duration === "Full Day") {
      return res.status(400).json({
        success: false,
        message: "Doctor is on full-day leave",
      });
    }

    // 2. Determine working hours
    const PRESETS = {
      morning:  { start: "09:00", end: "12:00" },
      afternoon: { start: "13:00", end: "17:00" },
      evening: { start: "18:00", end: "21:00" },
      "full-day": { start: "09:00", end: "21:00" }
    };

    let workingStart = PRESETS[preset]?.start || customStart;
    let workingEnd   = PRESETS[preset]?.end || customEnd;

    // 3. Apply half-day leave adjustments
    if (leave?.duration === "Half Day") {
      // Morning leave → work only afternoon
      if (leave.type === "morning") workingStart = "13:00";
      // Afternoon leave → work only morning
      if (leave.type === "afternoon") workingEnd = "13:00";
    }

    // 4. Generate slots
    const slots = generateSlots(workingStart, workingEnd, slotDuration, breaks);

    // 5. Save schedule
    const schedule = await DoctorSchedule.create({
      doctor: doctorId,
      date,
      dayName: new Date(date).toLocaleDateString("en-US", { weekday: "long" }),
      workingHours: { start: workingStart, end: workingEnd },
      slotDuration,
      preset,
      breaks,
      slots
    });

    return res.json({ success: true, schedule });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

