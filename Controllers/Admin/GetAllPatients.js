import userModel from "../../Models/User/UserModels.js";
import Appointment from "../../Models/Appointment/Appointment.js";

export const getAllPatients = async (req, res) => {
  try {
    // 1️⃣ Get all patients (excluding sensitive fields)
    const patients = await userModel
      .find({ role: "patient" })
      .select("-password -resetToken -verifyOtp");
    // console.log(patients);
    //     console.log("Patients found for receptionist:", patients.length);
    // console.log("Sample patient:", patients[0]);

    // 2️⃣ Get all appointments (populate doctor + receptionist + patient)
    const appointments = await Appointment.find()
      .populate({
        path: "doctor",
        select:
          "specialization department qualification experience consultationFee userId",
        populate: [
          {
            path: "userId",
            select: "fullName email",
          },
          {
            path: "department", // 🔹 populate department name
            select: "name", // only get the department name
          },
        ],
      })
      .populate({
        path: "patient",
        select: "fullName email phone age gender patientId address",
      });
    // console.log(appointments);

    // 3️⃣ Group appointments by patientId
    const appointmentsByPatient = appointments.reduce((acc, appointment) => {
      const pid = appointment.patient?._id?.toString();
      if (!pid) return acc;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(appointment);
      return acc;
    }, {});

    // 4️⃣ Merge patient info + their appointment summaries
    const patientsWithAppointments = patients.map((patient) => {
      const patientAppointments =
        appointmentsByPatient[patient._id.toString()] || [];

      const lastVisit = patientAppointments
        .filter((a) => a.status === "Completed")
        .sort(
          (a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate)
        )[0];

      const upcoming = patientAppointments
        .filter((a) => ["Pending", "Confirmed"].includes(a.status))
        .sort(
          (a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate)
        )[0];

      const cancelledCount = patientAppointments.filter(
        (a) => a.status === "Cancelled"
      ).length;

      const doctorsMap = {};
      let onlineVisitsCount = 0;
      let offlineVisitsCount = 0;

      patientAppointments.forEach((a) => {
        if (a.consultationType === "Online") onlineVisitsCount++;
        if (a.consultationType === "Offline") offlineVisitsCount++;

        if (a.doctor) {
          const docId = a.doctor._id.toString();
          if (!doctorsMap[docId]) {
            doctorsMap[docId] = {
              id: a.doctor._id,
              name: a.doctor.userId?.fullName,
              email: a.doctor.userId?.email,
              specialization: a.doctor.specialization,
              department: a.doctor.department,
              qualification: a.doctor.qualification,
              experience: a.doctor.experience,
              visits: [],
            };
          }
          doctorsMap[docId].visits.push({
            appointmentId: a._id,
            date: a.appointmentDate,
            status: a.status,
            consultationType: a.consultationType,
          });
        }
      });

      const doctorsSeen = Object.values(doctorsMap);
      const departmentsVisited = [
        ...new Set(doctorsSeen.map((doc) => doc.department).filter(Boolean)),
      ];

      return {
        id: patient._id,
        fullName: patient.fullName,
        email: patient.email,
        contact: patient.contact,
        gender: patient.gender,
        age: patient.age,
        dob: patient.dob,
        patientId: patient.patientId,
        address: patient.address, // ✅ include full address
        appointments: patientAppointments,
        summary: {
          totalVisits: patientAppointments.length,
          onlineVisits: onlineVisitsCount,
          offlineVisits: offlineVisitsCount,
          lastVisitDate: lastVisit ? lastVisit.appointmentDate : null,
          upcomingAppointment: upcoming || null,
          cancelledCount,
          doctorsSeen,
          departmentsVisited,
        },
      };
    });

    res.status(200).json(patientsWithAppointments);
  } catch (error) {
    console.error("getAllPatients Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Check if patient exists
    const patient = await userModel.findById(id);
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    // 2️⃣ Delete patient's appointments first (optional, to clean data)
    await Appointment.deleteMany({ patient: id });

    // 3️⃣ Delete patient
    await userModel.findByIdAndDelete(id);

    res
      .status(200)
      .json({ success: true, message: "Patient deleted successfully" });
  } catch (error) {
    console.error("deletePatient error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔹 Get single patient by ID
export const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Find patient
    const patient = await userModel
      .findById(id)
      .select("-password -resetToken -verifyOtp");
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    // 2️⃣ Get patient’s appointments
    const appointments = await Appointment.find({ patient: id })
      .populate({
        path: "doctor",
        select:
          "specialization department qualification experience consultationFee userId",
        populate: [
          { path: "userId", select: "fullName email" },
          { path: "department", select: "name" },
        ],
      })
      .populate({
        path: "patient",
        select: "fullName email phone age gender patientId address",
      });

    // 3️⃣ Calculate summary
    const lastVisit = appointments
      .filter((a) => a.status === "Completed")
      .sort(
        (a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate)
      )[0];

    const upcoming = appointments
      .filter((a) => ["Pending", "Confirmed"].includes(a.status))
      .sort(
        (a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate)
      )[0];

    const doctorsMap = {};
    let onlineVisitsCount = 0;
    let offlineVisitsCount = 0;

    appointments.forEach((a) => {
      if (a.consultationType === "Online") onlineVisitsCount++;
      if (a.consultationType === "Offline") offlineVisitsCount++;

      if (a.doctor) {
        const docId = a.doctor._id.toString();
        if (!doctorsMap[docId]) {
          doctorsMap[docId] = {
            id: a.doctor._id,
            name: a.doctor.userId?.fullName,
            email: a.doctor.userId?.email,
            specialization: a.doctor.specialization,
            department: a.doctor.department,
            qualification: a.doctor.qualification,
            experience: a.doctor.experience,
            visits: [],
          };
        }
        doctorsMap[docId].visits.push({
          appointmentId: a._id,
          date: a.appointmentDate,
          status: a.status,
          consultationType: a.consultationType,
        });
      }
    });

    const doctorsSeen = Object.values(doctorsMap);
    const departmentsVisited = [
      ...new Set(doctorsSeen.map((doc) => doc.department).filter(Boolean)),
    ];

    // 4️⃣ Final response
    const patientWithAppointments = {
      id: patient._id,
      fullName: patient.fullName,
      email: patient.email,
      contact: patient.contact,
      gender: patient.gender,
      age: patient.age,
      dob: patient.dob,
      patientId: patient.patientId,
      address: patient.address,
      appointments,
      summary: {
        totalVisits: appointments.length,
        onlineVisits: onlineVisitsCount,
        offlineVisits: offlineVisitsCount,
        lastVisitDate: lastVisit ? lastVisit.appointmentDate : null,
        upcomingAppointment: upcoming || null,
        cancelledCount: appointments.filter((a) => a.status === "Cancelled")
          .length,
        doctorsSeen,
        departmentsVisited,
      },
    };

    res.status(200).json(patientWithAppointments);
  } catch (error) {
    console.error("getPatientById error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
