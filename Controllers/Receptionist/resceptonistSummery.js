import Appointment from "../../Models/Appointment/Appointment.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import userModel from "../../Models/User/UserModels.js";

// 🔹 Helper: Get start & end of today
const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now.setHours(0, 0, 0, 0));
  const end = new Date(now.setHours(23, 59, 59, 999));
  return { start, end };
};

// 🔹 Fetch only future appointments with relevant statuses
export const getAllAppointments = async () => {
  const now = new Date();
  return Appointment.find({
    status: { $in: ["Pending", "Confirmed", "With-Doctor"] },
    appointmentDate: { $gte: now }, // only future appointments
  })
    .populate({
      path: "doctor",
      populate: [
        { path: "userId", select: "fullName email" },
        { path: "department", select: "name" },
      ],
    })
    .populate("patient")
    .populate("receptionist")
    .sort({ appointmentDate: 1 })
    .lean();
};

// 🔹 Map patient info
const mapPatientInfo = (appt) => {
  if (!appt.patient) return null;
  return {
    patientId: appt.patient.patientId || appt.patient._id,
    fullName: appt.patient.fullName || "Unknown",
    email: appt.patient.email || "N/A",
  };
};

// 🔹 Map doctor info
const mapDoctorInfo = (appt) => {
  if (!appt.doctor) return null;
  return {
    fullName: appt.doctor.userId?.fullName || "Unknown",
    email: appt.doctor.userId?.email || "N/A",
    department: appt.doctor.department?.name || "N/A",
    departmentId: appt.doctor.department?._id || null,
    specialization: appt.doctor.specialization || "N/A",
    availableDays: appt.doctor.availableDays || [],
  };
};

// 🔹 Map receptionist info
const mapReceptionistInfo = (appt) => {
  if (!appt.receptionist) return null;
  return {
    fullName: appt.receptionist.fullName || "Unknown",
    email: appt.receptionist.email || "N/A",
  };
};

// 🔹 Appointment Summary (Deduplicated & Upcoming Only)
export const getAppointmentsSummary = (appointments) => {
  const { start, end } = getTodayRange();
  const now = new Date();

  // Deduplicate by appointment _id
  const uniqueAppointments = Array.from(
    new Map(appointments.map((a) => [a._id.toString(), a])).values()
  );

  // Add extra info
  const allList = uniqueAppointments.map((appt) => ({
    ...appt,
    doctorInfo: mapDoctorInfo(appt),
    patientInfo: mapPatientInfo(appt),
    receptionistInfo: mapReceptionistInfo(appt),
  }));

  const all = { count: allList.length, list: allList };

  // Today's appointments
  const todayList = allList.filter(
    (appt) =>
      new Date(appt.appointmentDate) >= start &&
      new Date(appt.appointmentDate) <= end
  );

  const todayCountsByStatus = todayList.reduce((acc, appt) => {
    acc[appt.status] = (acc[appt.status] || 0) + 1;
    return acc;
  }, {});

  const today = {
    count: todayList.length,
    list: todayList,
    countsByStatus: todayCountsByStatus,
  };

  // Upcoming appointments (next 5)
  const upcomingList = allList
    .filter((appt) => new Date(appt.appointmentDate) >= now)
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate))
    .slice(0, 5);

  const upcoming = { count: upcomingList.length, list: upcomingList };

  // Next patients today (Pending & Confirmed)
  const nextPatientsList = todayList
    .filter((appt) => ["Pending", "Confirmed"].includes(appt.status))
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));

  const nextPatients = { count: nextPatientsList.length, list: nextPatientsList };

  return { all, today, upcoming, nextPatients };
};

// 🔹 Patients grouped by status (unique patients)
export const getAllPatientsInfo = (appointments) => {
  const patientsByStatus = {
    Pending: new Map(),
    Confirmed: new Map(),
    "With-Doctor": new Map(),
    Completed: new Map(),
  };

  appointments.forEach((appt) => {
    if (appt.patient && patientsByStatus[appt.status]) {
      const token = appt.patient.patientId || appt.patient._id.toString();
      patientsByStatus[appt.status].set(token, mapPatientInfo(appt));
    }
  });

  const patientsByStatusUnique = {};
  const patientStatusCounts = {};

  Object.entries(patientsByStatus).forEach(([status, map]) => {
    patientsByStatusUnique[status] = Array.from(map.values());
    patientStatusCounts[status] = map.size;
  });

  return { patientsByStatus: patientsByStatusUnique, patientStatusCounts };
};

// 🔹 Available doctors today
export const getAvailableDoctors = (appointments) => {
  const { start, end } = getTodayRange();
  const map = new Map();

  appointments.forEach((appt) => {
    const apptDate = new Date(appt.appointmentDate);
    if (
      appt.doctor &&
      ["Confirmed", "With-Doctor"].includes(appt.status) &&
      apptDate >= start &&
      apptDate <= end
    ) {
      map.set(appt.doctor._id.toString(), appt.doctor);
    }
  });

  return { count: map.size, list: Array.from(map.values()) };
};

// 🔹 Recent activities
export const getRecentActivities = (appointments) => {
  const list = appointments
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  return { count: list.length, list };
};

// 🔹 Today's registered patients
export const getTodayRegisteredPatients = async () => {
  const { start, end } = getTodayRange();
  const list = await userModel.find({ role: "patient", createdAt: { $gte: start, $lte: end } }).lean();
  return { count: list.length, list };
};

// 🔹 Walk-in patients
export const getWalkInPatients = (appointments) => {
  const walkIns = appointments.filter((appt) => appt.isWalkIn);
  return { count: walkIns.length, list: walkIns.map((a) => mapPatientInfo(a)) };
};

// 🔹 Receptionist dashboard controller
export const getReceptionistDashboard = async (req, res) => {
  try {
    const allAppointments = await getAllAppointments();
    const appointmentSummary = getAppointmentsSummary(allAppointments);
    const { patientsByStatus, patientStatusCounts } = getAllPatientsInfo(allAppointments);
    const availableDoctors = getAvailableDoctors(allAppointments);
    const recentActivities = getRecentActivities(allAppointments);
    const todayRegisteredPatients = await getTodayRegisteredPatients();

    res.status(200).json({
      patients: {
        total: Object.values(patientStatusCounts).reduce((a, b) => a + b, 0),
        byStatus: patientsByStatus,
        counts: patientStatusCounts,
      },
      appointments: appointmentSummary,
      availableDoctors,
      recentActivities,
      todayRegisteredPatients,
      walkInPatients: getWalkInPatients(allAppointments),
    });
  } catch (error) {
    console.error("Receptionist Dashboard Error:", error);
    res.status(500).json({ message: "Error fetching dashboard", error });
  }
};
