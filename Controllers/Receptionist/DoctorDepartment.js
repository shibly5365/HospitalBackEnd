import doctorModel from "../../Models/Doctor/DoctorModels.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import Department from "../../Models/Departmenst/DepartmenstModels.js";

// Get all doctors
export const getAllDoctors = async (req, res) => {
  try {
    const { department, available, search } = req.query;

    let filter = {};

    if (department) filter.department = department;
    if (available) filter.status = "available";

    let doctors = await doctorModel
      .find(filter)
      .populate({
        path: "userId",
        select: "fullName email profileImage",
      })
      .populate({
        path: "department",
        select: "name description",
      })
      .sort({ createdAt: -1 });

    // Search filter
    if (search) {
      doctors = doctors.filter((doctor) => {
        const name = doctor.userId?.fullName?.toLowerCase() || "";
        const specialization = doctor.specialization?.toLowerCase() || "";
        const dept = doctor.department?.name?.toLowerCase() || "";
        const searchLower = search.toLowerCase();
        return (
          name.includes(searchLower) ||
          specialization.includes(searchLower) ||
          dept.includes(searchLower)
        );
      });
    }

    res.json({
      success: true,
      data: {
        doctors,
        count: doctors.length,
      },
    });
  } catch (error) {
    console.error("Get all doctors error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get doctors on duty today
export const getDoctorsOnDutyToday = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get doctors who have appointments today
    const appointmentsToday = await Appointment.find({
      appointmentDate: { $gte: today, $lt: tomorrow },
      status: { $in: ["Confirmed", "With-Doctor"] },
    }).distinct("doctor");

    const doctors = await doctorModel
      .find({ _id: { $in: appointmentsToday } })
      .populate({
        path: "userId",
        select: "fullName email profileImage",
      })
      .populate({
        path: "department",
        select: "name description",
      });

    res.json({
      success: true,
      data: {
        doctors,
        count: doctors.length,
      },
    });
  } catch (error) {
    console.error("Get doctors on duty today error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all departments
export const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });

    // Get doctor count for each department
    const departmentsWithCount = await Promise.all(
      departments.map(async (dept) => {
        const doctorCount = await doctorModel.countDocuments({ department: dept._id });
        return {
          ...dept.toObject(),
          doctorCount,
        };
      })
    );

    res.json({
      success: true,
      data: {
        departments: departmentsWithCount,
        count: departmentsWithCount.length,
      },
    });
  } catch (error) {
    console.error("Get all departments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get doctor timings/schedule
export const getDoctorTimings = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await doctorModel
      .findById(doctorId)
      .populate({
        path: "userId",
        select: "fullName",
      })
      .populate({
        path: "department",
        select: "name description",
      });

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    res.json({
      success: true,
      data: {
        doctor: {
          _id: doctor._id,
          name: doctor.userId?.fullName,
          department: doctor.department?.name,
          specialization: doctor.specialization,
          availableDays: doctor.availableDays,
          availableSlots: doctor.availableSlots,
          consultationFee: doctor.consultationFee,
          duration: doctor.duration,
        },
      },
    });
  } catch (error) {
    console.error("Get doctor timings error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
