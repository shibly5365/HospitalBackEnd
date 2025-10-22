import moment from "moment";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";

// ================= SLOT GENERATOR =================
function generateSlots(start, end, breaks = [], slotDuration = 30) {
  const slots = [];
  const current = moment.utc(start, "HH:mm");
  const endTime = moment.utc(end, "HH:mm");

  while (current.clone().add(slotDuration, "minutes").isSameOrBefore(endTime)) {
    const slotStart = current.clone();
    const slotEnd = current.clone().add(slotDuration, "minutes");

    const isBreak = breaks.some((b) => {
      const breakStart = moment.utc(b.start, "HH:mm");
      const breakEnd = moment.utc(b.end, "HH:mm");
      return slotStart.isBefore(breakEnd) && slotEnd.isAfter(breakStart);
    });

    if (!isBreak) {
      slots.push({
        start: slotStart.format("HH:mm"),
        end: slotEnd.format("HH:mm"),
        isBooked: false,
      });
    }
    current.add(slotDuration, "minutes");
  }
  return slots;
}

// ================= CREATE SCHEDULE (WEEK OR DATE) =================
export const createSchedule = async (req, res) => {
  try {
    let {
      doctorId,
      weekDays,        // for weekly schedule (["Monday", "Wednesday"])
      weeksAhead = 4,  // how many weeks ahead to create
      selectedDates,   // for random date schedule
      workingHours,
      breaks,
    } = req.body;

    // Get doctorId if the user is a doctor
    if (req.user.role === "doctor") {
      const doctor = await doctorModel.findOne({ userId: req.user._id });
      if (!doctor)
        return res.status(404).json({
          success: false,
          message: "Doctor profile not found",
        });
      doctorId = doctor._id;
    }

    // Validate required fields
    if (!doctorId || !workingHours) {
      return res.status(400).json({
        success: false,
        message: "doctorId and workingHours are required",
      });
    }

    if (
      (!weekDays || !weekDays.length) &&
      (!selectedDates || !selectedDates.length)
    ) {
      return res.status(400).json({
        success: false,
        message: "Either weekDays or selectedDates must be provided",
      });
    }

    const createdSchedules = [];
    const today = moment().startOf("day");

    // 1️⃣ WEEKLY SCHEDULE (Day-based → generate actual dates)
    if (weekDays && weekDays.length) {
      for (let i = 0; i < weeksAhead; i++) {
        for (const day of weekDays) {
          // Generate the correct date for the day in the week
          let scheduleDate = today.clone().add(i, "weeks").day(day);

          // If the generated date is before today, move to next week
          if (scheduleDate.isBefore(today)) {
            scheduleDate = scheduleDate.add(1, "weeks");
          }

          // Skip if already exists
          const existing = await DoctorSchedule.findOne({
            doctor: doctorId,
            date: scheduleDate.toDate(),
          });
          if (existing) continue;

          const slots = generateSlots(
            workingHours.start,
            workingHours.end,
            breaks || []
          );

          const newSchedule = await DoctorSchedule.create({
            doctor: doctorId,
            date: scheduleDate.toDate(),
            dayName: scheduleDate.format("dddd"),
            workingHours,
            breaks,
            slots,
          });

          createdSchedules.push(newSchedule);
        }
      }
    }

    // 2️⃣ RANDOM DATE SCHEDULE (Doctor selects exact dates)
    if (selectedDates && selectedDates.length) {
      for (const dateStr of selectedDates) {
        const scheduleDate = moment(dateStr, "YYYY-MM-DD").startOf("day");
        if (!scheduleDate.isValid()) continue;

        // Skip if already exists
        const existing = await DoctorSchedule.findOne({
          doctor: doctorId,
          date: scheduleDate.toDate(),
        });
        if (existing) continue;

        const slots = generateSlots(
          workingHours.start,
          workingHours.end,
          breaks || []
        );

        const newSchedule = await DoctorSchedule.create({
          doctor: doctorId,
          date: scheduleDate.toDate(),
          dayName: scheduleDate.format("dddd"),
          workingHours,
          breaks,
          slots,
        });

        createdSchedules.push(newSchedule);
      }
    }

    // Return response
    if (!createdSchedules.length) {
      return res.status(200).json({
        success: true,
        message: "No new schedules created (dates may already exist).",
        schedules: [],
      });
    }

    return res.status(201).json({
      success: true,
      message: "Schedules created successfully",
      schedules: createdSchedules,
    });
  } catch (error) {
    console.log("createSchedule error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ================= GET ALL SCHEDULES (ADMIN) =================
export const getDoctorSchedules = async (req, res) => {
  try {
    const query = {};

    if (req.query.doctorId) {
      query.doctor = req.query.doctorId;
      query.date = { $gte: new Date() };
    }

    const schedules = await DoctorSchedule.find(query)
      .populate("doctor", "name specialization")
      .sort({ date: 1 });

    if (!schedules.length)
      return res
        .status(404)
        .json({ success: false, message: "No schedules found" });

    res.status(200).json({ success: true, schedules });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= GET SCHEDULES BY DOCTOR ID =================
export const getSchedulesByDoctorId = async (req, res) => {
  try {
    const doctorId = req.params.id;
    const { date } = req.query;

    if (!doctorId)
      return res
        .status(400)
        .json({ success: false, message: "doctorId is required" });

    const query = { doctor: doctorId };

    if (date) {
      const parsedDate = moment.utc(date, "YYYY-MM-DD", true);
      if (!parsedDate.isValid()) {
        return res.status(400).json({
          success: false,
          message: `Invalid date format: ${date}. Use YYYY-MM-DD.`,
        });
      }
      query.date = {
        $gte: parsedDate.startOf("day").toDate(),
        $lte: parsedDate.endOf("day").toDate(),
      };
    }

    const schedules = await DoctorSchedule.find(query)
      .populate("doctor", "name specialization")
      .sort({ date: 1 });

    if (!schedules.length)
      return res.status(404).json({
        success: false,
        message: "No schedules found for this doctor",
      });

    res.status(200).json({ success: true, schedules });
  } catch (error) {
    console.error("Error fetching doctor schedules:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { slots, date, workingHours, breaks } = req.body;

    const schedule = await DoctorSchedule.findById(scheduleId);
    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found" });
    }

    // Update slots directly if provided
    if (slots) {
      schedule.slots = slots;
    }

    // Update date if provided
    if (date) {
      const parsedDate = moment.utc(date, "YYYY-MM-DD", true);
      if (!parsedDate.isValid()) {
        return res.status(400).json({
          success: false,
          message: `Invalid date format: ${date}. Use YYYY-MM-DD.`,
        });
      }
      schedule.date = parsedDate.startOf("day").toDate();
      schedule.dayName = parsedDate.format("dddd");
    }

    // Update workingHours if provided
    let updatedWorkingHours = schedule.workingHours; // fallback to existing
    if (workingHours) {
      if (!workingHours.start || !workingHours.end) {
        return res.status(400).json({
          success: false,
          message: "Both workingHours.start and workingHours.end are required",
        });
      }
      updatedWorkingHours = workingHours;
      schedule.workingHours = updatedWorkingHours;
    }

    // Update breaks if provided
    if (breaks) {
      schedule.breaks = breaks;
    }

    // Regenerate slots only if workingHours or breaks changed
    if (workingHours || breaks) {
      schedule.slots = generateSlots(
        updatedWorkingHours.start,
        updatedWorkingHours.end,
        breaks || schedule.breaks
      );
    }

    await schedule.save();

    res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      schedule,
    });
  } catch (error) {
    console.error("Error updating schedule:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= GET DOCTOR AVAILABLE DATES (PATIENT) =================
export const getDoctorAvailableDates = async (req, res) => {
  try {
    const doctorId = req.params.id;
    const selectedDate = req.query.date; // patient selected date (YYYY-MM-DD)

    if (!doctorId)
      return res
        .status(400)
        .json({ success: false, message: "doctorId is required" });

    const doctor = await doctorModel
      .findById(doctorId)
      .populate("userId", "-password");

    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    // Fetch all schedules of doctor
    const schedules = await DoctorSchedule.find({ doctor: doctorId });

    const today = new Date();
    let availableSchedules = schedules.filter(
      (schedule) =>
        schedule.date &&
        new Date(schedule.date) >= today &&
        schedule.slots.some((slot) => !slot.isBooked)
    );

    // If patient selected a date -> filter only that date slots
    if (selectedDate) {
      availableSchedules = availableSchedules.filter(
        (s) => new Date(s.date).toISOString().split("T")[0] === selectedDate
      );
    }

    const dates = [
      ...new Set(
        availableSchedules
          .map(
            (schedule) => new Date(schedule.date).toISOString().split("T")[0]
          )
          .sort()
      ),
    ];

    res.json({
      success: true,
      doctor,
      dates,
      schedules: availableSchedules,
    });
  } catch (err) {
    console.log("Error fetching available dates:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= DELETE SCHEDULE (ADMIN ONLY) =================
export const deleteSchedule = async (req, res) => {
  try {
    const scheduleId = req.params.id; // ✅ fixed

    // console.log("Deleting schedule id:", scheduleId);

    const schedule = await DoctorSchedule.findById(scheduleId);
    // console.log(schedule);

    if (!schedule)
      return res.status(404).json({ message: "Schedule not found" });

    await DoctorSchedule.findByIdAndDelete(scheduleId);

    res
      .status(200)
      .json({ success: true, message: "Schedule deleted successfully" });
  } catch (error) {
    console.log("Error deleting schedule:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
