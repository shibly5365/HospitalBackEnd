import moment from "moment";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";

// ================= GET FREE SLOTS =================
// Receptionist & Patient can view free slots
// ================= GET FREE SLOTS =================
export const getFreeSlots = async (req, res) => {
  try {
    const doctorId = req.params.id;
    const { date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({
        success: false,
        message: "doctorId and date are required"
      });
    }

    const startOfDay = moment(date).startOf("day").toDate();
    const endOfDay = moment(date).endOf("day").toDate();

    console.log("DoctorId:", doctorId);
    console.log("StartOfDay:", startOfDay);
    console.log("EndOfDay:", endOfDay);

    const schedule = await DoctorSchedule.findOne({
      doctor: doctorId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (!schedule) {
      console.log("No schedule found!");
      return res.status(404).json({
        success: false,
        message: "No schedule found for this doctor on this date"
      });
    }

    console.log("Schedule found:", schedule._id, "with slots:", schedule.slots.length);

    const freeSlots = schedule.slots.filter(s => !s.isBooked);

    res.status(200).json({
      success: true,
      doctorId,
      date: moment(schedule.date).format("YYYY-MM-DD"),
      totalSlots: schedule.slots.length,
      freeSlots
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

