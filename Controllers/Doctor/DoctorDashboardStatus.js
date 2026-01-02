// import mongoose from "mongoose";
// import Appointment from "../../Models/Appointment/Appointment.js";
// import doctorModel from "../../Models/Doctor/DoctorModels.js";

import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";

export const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user._id; // logged-in user ID
    // console.log("Logged-in userId:", userId);

    // Find the doctor profile linked to this user
    const doctor = await doctorModel.findOne({ userId });
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    // Get all appointments for this doctor
    const appointments = await Appointment.find({
      doctor: doctor._id,
    }).populate("patient", "gender fullName");
    console.log(appointments);
    

    // Calculate unique patients
    const uniquePatients = new Set(
      appointments.map((a) => a.patient?._id.toString())
    );

    // Count genders
    let maleCount = 0;
    let femaleCount = 0;
    let otherCount = 0;
appointments.forEach((a) => {
  const g = a.patient?.gender;
  if (g === "Male") maleCount++;
  else if (g === "Female") femaleCount++;
  else otherCount++;
});

    // Filter today's appointments
    const today = new Date();
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0,
      0,
      0
    );
    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59
    );

    const todaysAppointments = appointments.filter((a) => {
      const date = new Date(a.appointmentDate);
      return date >= start && date <= end;
    });

    // Send dashboard summary
    res.json({
      totalPatients: uniquePatients.size,
      genderSummary: { maleCount, femaleCount, otherCount },
      todaysPatients: todaysAppointments.length,
    });
  } catch (error) {
    console.log("getDashboardSummary error:", error);
    res.status(500).json({ error: error.message });
  }
};

// // 🔹 Helper: convert appointmentDate + timeSlot.start to timestamp
// const getAppointmentDateTime = (date, startTime) => {
//   const [hours, minutes] = startTime.split(":").map(Number);
//   const dt = new Date(date);
//   dt.setHours(hours, minutes, 0, 0);
//   return dt.getTime();
// };

// // ------------------- Dashboard Summary -------------------
// export const getDashboardSummary = async (req, res) => {
//   try {
//     // 🔹 Find doctor
//     const userId = req.user._id;
//     // console.log(userId);

//     // Use userId, not user
//     const doctor = await doctorModel.findOne({ userId }).populate("department");

//     if (!doctor) {
//       return res.status(404).json({ error: "Doctor profile not found" });
//     }

//     // console.log("Doctor found:", doctor);

//     if (!doctor)
//       return res.status(404).json({ error: "Doctor profile not found" });

//     const doctorId = doctor._id;

//     // 🔹 Date boundaries (UTC safe)
//     const today = new Date();
//     const yyyy = today.getUTCFullYear();
//     const mm = today.getUTCMonth();
//     const dd = today.getUTCDate();

//     const startOfToday = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0));
//     const endOfToday = new Date(Date.UTC(yyyy, mm, dd + 1, 0, 0, 0));

//     // ---------------- All Appointments ----------------
//     const allAppointments = await Appointment.find({
//       doctor: doctorId,
//     }).populate("patient", "fullName");

//     // Status counts
//     const pendingList = allAppointments.filter((a) => a.status === "Pending");
//     const confirmedList = allAppointments.filter(
//       (a) => a.status === "Confirmed"
//     );
//     const completedList = allAppointments.filter(
//       (a) => a.status === "Completed"
//     );
//     const cancelledList = allAppointments.filter(
//       (a) => a.status === "Cancelled"
//     );

//     // ---------------- Today’s Appointments ----------------
//     const todaysAppointments = await Appointment.find({
//       doctor: doctorId,
//       appointmentDate: { $gte: startOfToday, $lt: endOfToday },
//     }).populate("patient", "fullName");

//     const patientsToday = new Set(
//       todaysAppointments.map((a) => a.patient?._id.toString())
//     ).size;

//     // ---------------- Next Appointment ----------------
//     const now = Date.now();
//     const appointmentsWithTime = allAppointments.map((a) => {
//       const appointmentTime = getAppointmentDateTime(
//         a.appointmentDate,
//         a.timeSlot?.start
//       );
//       return { ...a.toObject(), appointmentTime };
//     });

//     appointmentsWithTime.sort((a, b) => a.appointmentTime - b.appointmentTime);

//     const nextAppointmentData =
//       appointmentsWithTime.find((a) => a.appointmentTime > now) || null;

//     const nextAppointment = nextAppointmentData
//       ? {
//           patientName: nextAppointmentData.patient?.fullName || "Unknown",
//           timeSlot: nextAppointmentData.timeSlot
//             ? `${nextAppointmentData.timeSlot.start} - ${nextAppointmentData.timeSlot.end}`
//             : "Time not set",
//           appointmentDate: nextAppointmentData.appointmentDate,
//           type: nextAppointmentData.consultationType || "appointment",
//         }
//       : null;

//     // ---------------- Progress ----------------
//     const progress = {
//       completed: completedList.length,
//       total: allAppointments.length,
//       percent:
//         allAppointments.length > 0
//           ? Math.round((completedList.length / allAppointments.length) * 100)
//           : 0,
//     };

//     // ---------------- Recent Activity ----------------
//     const recentActivity = await Appointment.find({ doctor: doctorId })
//       .sort({ updatedAt: -1 })
//       .limit(5)
//       .populate("patient", "fullName");

//     // ---------------- Response ----------------
//     res.json({
//       doctorName: req.user.fullName,
//       doctorDepartment: doctor.department?.name || "Unknown",
//       totalAppointments: allAppointments.length,
//       pending: { list: pendingList, count: pendingList.length },
//       confirmed: { list: confirmedList, count: confirmedList.length },
//       completed: { list: completedList, count: completedList.length },
//       cancelled: { list: cancelledList, count: cancelledList.length },
//       patientsToday,
//       nextAppointment,
//       progress,
//       recentActivity,
//       todayAppointments: todaysAppointments,
//     });
//   } catch (err) {
//     console.log("getDashboardSummary error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ------------------- Today's Schedule -------------------
// export const getTodaysSchedule = async (req, res) => {
//   try {
//     const doctor = await doctorModel.findOne({ userId: req.user._id });
//     if (!doctor)
//       return res.status(404).json({ error: "Doctor profile not found" });

//     const doctorId = doctor._id;

//     const today = new Date();
//     const startOfToday = new Date(today);
//     startOfToday.setHours(0, 0, 0, 0);
//     const endOfToday = new Date(today);
//     endOfToday.setHours(23, 59, 59, 999);

//     // Fetch ALL upcoming appointments for this doctor
//     const allAppointments = await Appointment.find({
//       doctor: doctorId,
//       status: { $ne: "Cancelled" },
//     }).populate("patient", "fullName email phone isOnline");

//     const now = Date.now();

//     // --- Today’s appointments ---
//     const todaysAppointments = allAppointments.filter((a) => {
//       const apptDate = new Date(a.appointmentDate);
//       return apptDate >= startOfToday && apptDate <= endOfToday;
//     });

//     // --- Pending Appointments (status = Pending) ---
//     const pendingAppointments = allAppointments.filter(
//       (a) => a.status === "Pending"
//     );

//     // --- Upcoming Appointments (future date/time) ---
//     const upcomingAppointments = allAppointments.filter((a) => {
//       const apptTime = getAppointmentDateTime(
//         a.appointmentDate,
//         a.timeSlot?.start
//       );
//       return apptTime > now;
//     });

//     // --- Next Appointment ---
//     const nextAppointment =
//       upcomingAppointments.length > 0
//         ? upcomingAppointments.sort(
//             (a, b) =>
//               getAppointmentDateTime(a.appointmentDate, a.timeSlot?.start) -
//               getAppointmentDateTime(b.appointmentDate, b.timeSlot?.start)
//           )[0]
//         : null;

//     // --- Online Patients (only unique patients with isOnline true) ---
//     const onlinePatients = [
//       ...new Map(
//         allAppointments
//           .filter((a) => a.patient?.isOnline)
//           .map((a) => [a.patient._id.toString(), a.patient])
//       ).values(),
//     ];

//     res.json({
//       success: true,
//       nextAppointment: nextAppointment
//         ? {
//             patientName: nextAppointment.patient?.fullName || "Unknown",
//             patientEmail: nextAppointment.patient?.email || "",
//             patientPhone: nextAppointment.patient?.phone || "",
//             timeSlot: `${nextAppointment.timeSlot.start} - ${nextAppointment.timeSlot.end}`,
//             appointmentDate: nextAppointment.appointmentDate,
//             type: nextAppointment.consultationType || "appointment",
//           }
//         : null,
//       todaysAppointments,
//       pendingAppointments,
//       upcomingAppointments,
//       onlinePatients,
//     });
//   } catch (err) {
//     console.error("getTodaysSchedule error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };
