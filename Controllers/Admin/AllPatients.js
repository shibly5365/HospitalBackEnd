// import Appointment from "../../Models/Appointment/Appointment.js";
// import userModel from "../../Models/User/UserModels.js";

// export const getAllPatientsFullDetails = async (req, res) => {
//   try {
//     // Find all patients
//     const patients = await userModel
//       .find({ role: "patient" })
//       .select("-password")
//       .lean();

//     // Get all appointments for those patients
//     const patientIds = patients.map((p) => p._id);

//     const appointments = await Appointment.find({
//       patient: { $in: patientIds },
//     })
//       .populate("doctor", "fullName specialization")
//       .populate("receptionist", "fullName")
//       .sort({ appointmentDate: -1 }) // latest first
//       .lean();

//     // Attach appointment details
//     const patientDetails = patients.map((p) => {
//       const patientAppointments = appointments.filter(
//         (a) => a.patient.toString() === p._id.toString()
//       );

//       const now = new Date();

//       // Next upcoming appointment
//       const nextAppointment =
//         patientAppointments
//           .filter((a) => new Date(a.appointmentDate) > now)
//           .sort(
//             (a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate)
//           )[0] || null;

//       // Last visit (most recent past appointment)
//       const lastVisit =
//         patientAppointments
//           .filter((a) => new Date(a.appointmentDate) <= now)
//           .sort(
//             (a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate)
//           )[0] || null;

//       // Recent appointments (limit 5)
//       const recentAppointments = patientAppointments.slice(0, 5);

//       return {
//         ...p,
//         nextAppointment,
//         lastVisit,
//         recentAppointments,
//       };
//     });

//     res.status(200).json(patientDetails);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to fetch full patient details" });
//   }
// };
