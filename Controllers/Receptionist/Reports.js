import Appointment from "../../Models/Appointment/Appointment.js";
import Payment from "../../Models/Payments/paymentSchema.js";
import userModel from "../../Models/User/UserModels.js";
import MedicalRecord from "../../Models/MedicalRecord/MedicalRecord.js";

// Helper: Get date range
const getDateRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Daily Appointments Report
export const getDailyAppointmentsReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const { start, end } = getDateRange(targetDate);

    const appointments = await Appointment.find({
      appointmentDate: { $gte: start, $lte: end },
    })
      .populate({
        path: "patient",
        select: "fullName email contact patientId",
      })
      .populate({
        path: "doctor",
        populate: [
          {
            path: "userId",
            select: "fullName",
          },
          {
          path: "department",
          select: "name description",
        },
        ],
      })
      .sort({ appointmentDate: 1 });

    // Status counts
    const statusCounts = appointments.reduce(
      (acc, apt) => {
        acc[apt.status] = (acc[apt.status] || 0) + 1;
        return acc;
      },
      {}
    );

    // Department wise
    const departmentWise = appointments.reduce((acc, apt) => {
      const dept = apt.doctor?.department?.name || "Unknown";
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split("T")[0],
        totalAppointments: appointments.length,
        appointments,
        statusCounts,
        departmentWise,
      },
    });
  } catch (error) {
    console.error("Daily appointments report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Daily Billing Report
export const getDailyBillingReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const { start, end } = getDateRange(targetDate);

    const payments = await Payment.find({
      createdAt: { $gte: start, $lte: end },
    })
      .populate({
        path: "patient",
        select: "fullName email contact",
      })
      .populate({
        path: "appointment",
        populate: {
          path: "doctor",
          populate: {
            path: "userId",
            select: "fullName",
          },
        },
      })
      .sort({ createdAt: -1 });

    // Calculate totals
    const totalRevenue = payments
      .filter((p) => p.status === "Paid")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const pendingAmount = payments
      .filter((p) => p.status === "Pending")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Method wise
    const methodWise = payments.reduce((acc, p) => {
      if (p.status === "Paid") {
        acc[p.method] = (acc[p.method] || 0) + (p.amount || 0);
      }
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split("T")[0],
        totalPayments: payments.length,
        totalRevenue,
        pendingAmount,
        payments,
        methodWise,
        statusCounts: {
          Paid: payments.filter((p) => p.status === "Paid").length,
          Pending: payments.filter((p) => p.status === "Pending").length,
          Failed: payments.filter((p) => p.status === "Failed").length,
        },
      },
    });
  } catch (error) {
    console.error("Daily billing report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// New Patient Registrations Report
export const getNewPatientRegistrationsReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let filter = { role: "patient" };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    } else {
      // Default to today
      const { start, end } = getDateRange(new Date());
      filter.createdAt = { $gte: start, $lte: end };
    }

    const patients = await userModel
      .find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    // Group by date
    const byDate = patients.reduce((acc, patient) => {
      const date = new Date(patient.createdAt).toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalRegistrations: patients.length,
        patients,
        byDate,
        period: {
          start: startDate || new Date().toISOString().split("T")[0],
          end: endDate || new Date().toISOString().split("T")[0],
        },
      },
    });
  } catch (error) {
    console.error("New patient registrations report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reception Activity Log
export const getReceptionActivityLog = async (req, res) => {
  try {
    const receptionistId = req.user._id;
    const { startDate, endDate, limit = 50 } = req.query;

    let filter = { receptionist: receptionistId };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Get appointments created by receptionist
    const appointments = await Appointment.find(filter)
      .populate({
        path: "patient",
        select: "fullName patientId",
      })
      .populate({
        path: "doctor",
        populate: {
          path: "userId",
          select: "fullName",
        },
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Format activity log
    const activities = appointments.map((apt) => ({
      id: apt._id,
      type: "appointment",
      action: apt.status === "Cancelled" ? "Cancelled" : "Created",
      patientName: apt.patient?.fullName || "Unknown",
      doctorName: apt.doctor?.userId?.fullName || "Unknown",
      date: apt.appointmentDate,
      timestamp: apt.createdAt,
      status: apt.status,
    }));

    res.json({
      success: true,
      data: {
        activities,
        count: activities.length,
      },
    });
  } catch (error) {
    console.error("Reception activity log error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
