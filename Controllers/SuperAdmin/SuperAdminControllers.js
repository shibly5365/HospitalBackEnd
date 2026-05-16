import userModel from "../../Models/User/UserModels.js";
import bcrypt from "bcrypt";
import Appointment from "../../Models/Appointment/Appointment.js";
import Payment from "../../Models/Payments/paymentSchema.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DepartmentModel from "../../Models/Departmenst/DepartmenstModels.js";
import { uploadToCloudinary } from "../../Units/uploadToCloudinary.js";

export const CreateAdmin = async (req, res) => {
  try {
    const { fullName, email, password, contact, role } = req.body;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let profileImageUrl = "";
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, role);
      profileImageUrl = result.secure_url;
    }

    const newAdmin = new userModel({
      fullName,
      email,
      password: hashedPassword,
      contact,
      role: "admin",
      profileImage: profileImageUrl,
    });

    await newAdmin.save();

    res.status(201).json({
      success: true,
      message: "admin created successfully",
      data: newAdmin,
    });
  } catch (error) {
    console.log("adminCreatederror", error);

    res
      .status(500)
      .json({ success: false, message: error.message, msg: "hello i am here" });
  }
};

export const getAllAdmin = async (req, res) => {
  try {
    const admins = await userModel.find({ role: "admin" });
    res.json(admins);
  } catch (error) {
    console.log("getAllAdmin", error);

    res.status(500).json({ error: error.message });
  }
};

export const UpdatedAdmin = async (req, res) => {
  try {
    const UpdatedAdmin = await userModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(UpdatedAdmin);
  } catch (error) {
    console.log("UpadedAdmin", error);
    res.status(500).json({ error: error.message });
  }
};

export const DeleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const admins = await userModel.findById(id);
    if (!admins) return res.status(404).json({ message: "User Not found" });
    await userModel.findByIdAndDelete(id);
    res.json({ message: "Admin delete is successfully" });
  } catch (error) {
    console.log("deleteAdmin", error);
    res.status(500).json({ error: error.message });
  }
};

// Block/Unblock Admin
export const toggleBlockAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await userModel.findById(id);
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    admin.isBlocked = !admin.isBlocked;
    await admin.save();

    res.json({
      success: true,
      message: admin.isBlocked
        ? "Admin blocked successfully"
        : "Admin unblocked successfully",
      data: admin,
    });
  } catch (error) {
    console.log("toggleBlockAdmin error", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get Admin Details with Activity
export const getAdminDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await userModel.findById(id).select("-password");
    if (!admin || admin.role !== "admin") {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    // Count doctors (assuming admin creates doctors - we'll check appointments createdBy)
    // Since there's no direct createdBy in doctor model, we'll count appointments created by this admin
    const appointmentsCreated = await Appointment.countDocuments({
      createdBy: admin._id,
    });

    // Count receptionists created (check if we can track this)
    // For now, we'll use a different approach - count receptionists that might have been created around the same time
    // Or we can add a createdBy field later. For now, let's use appointments as activity indicator

    // Get recent appointments created by this admin
    const recentAppointments = await Appointment.find({ createdBy: admin._id })
      .populate("patient", "fullName email")
      .populate("doctor", "specialization")
      .populate({
        path: "doctor",
        populate: { path: "userId", select: "fullName" },
      })
      .sort({ createdAt: -1 })
      .limit(10);

    // Count departments (if admin creates departments)
    // We'll track through appointments for now

    // Get activity summary
    const activitySummary = {
      totalAppointmentsCreated: appointmentsCreated,
      recentAppointments: recentAppointments,
      accountCreated: admin.createdAt,
      lastActive: admin.updatedAt,
    };

    res.json({
      success: true,
      data: {
        admin,
        activity: activitySummary,
      },
    });
  } catch (error) {
    console.log("getAdminDetails error", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get All Payments for Super Admin
export const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, method, doctorId } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (method) query.method = method;

    // Get payments with populated data
    const payments = await Payment.find(query)
      .populate({
        path: "patient",
        select: "fullName email contact profileImage",
      })
      .populate({
        path: "appointment",
        populate: {
          path: "doctor",
          populate: {
            path: "userId",
            select: "fullName email profileImage",
          },
          select: "specialization doctorId",
        },
        select: "appointmentDate timeSlot consultationType",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Payment.countDocuments(query);

    // Get payment statistics
    const stats = await Payment.aggregate([
      {
        $facet: {
          totalRevenue: [
            { $match: { status: "Paid" } },
            {
              $group: {
                _id: null,
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
          ],
          byStatus: [
            {
              $group: {
                _id: "$status",
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
          ],
          byMethod: [
            { $match: { status: "Paid" } },
            {
              $group: {
                _id: "$method",
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
          ],
          byDoctor: [
            {
              $match: { status: "Paid" },
            },
            {
              $lookup: {
                from: "appointments",
                localField: "appointment",
                foreignField: "_id",
                as: "appointmentData",
              },
            },
            { $unwind: "$appointmentData" },
            {
              $group: {
                _id: "$appointmentData.doctor",
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
            { $sort: { total: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ]);

    // Populate doctor info for byDoctor stats
    const byDoctorStats = await Promise.all(
      stats[0].byDoctor.map(async (item) => {
        const doctor = await doctorModel
          .findById(item._id)
          .populate("userId", "fullName email profileImage")
          .select("specialization doctorId");
        return {
          doctorId: doctor?._id,
          doctorName: doctor?.userId?.fullName || "Unknown",
          doctorEmail: doctor?.userId?.email || "N/A",
          doctorImage: doctor?.userId?.profileImage || null,
          specialization: doctor?.specialization || "N/A",
          totalRevenue: item.total,
          paymentCount: item.count,
        };
      })
    );

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
        statistics: {
          totalRevenue: stats[0].totalRevenue[0] || { total: 0, count: 0 },
          byStatus: stats[0].byStatus,
          byMethod: stats[0].byMethod,
          topDoctors: byDoctorStats,
        },
      },
    });
  } catch (error) {
    console.log("getAllPayments error", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get Payments by Doctor
export const getPaymentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { page = 1, limit = 20, status, method } = req.query;
    const skip = (page - 1) * limit;

    // Find all appointments for this doctor
    const doctorAppointments = await Appointment.find({
      doctor: doctorId,
    }).select("_id");
    const appointmentIds = doctorAppointments.map((apt) => apt._id);

    // Build query
    const query = { appointment: { $in: appointmentIds } };
    if (status) query.status = status;
    if (method) query.method = method;

    // Get payments
    const payments = await Payment.find(query)
      .populate({
        path: "patient",
        select: "fullName email contact profileImage",
      })
      .populate({
        path: "appointment",
        select: "appointmentDate timeSlot consultationType",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    // Get doctor info
    const doctor = await doctorModel
      .findById(doctorId)
      .populate("userId", "fullName email profileImage")
      .select("specialization doctorId");

    // Get statistics for this doctor
    const stats = await Payment.aggregate([
      {
        $match: {
          appointment: { $in: appointmentIds },
          status: "Paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalPayments: { $sum: 1 },
        },
      },
    ]);

    // Monthly revenue for last 6 months
    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          appointment: { $in: appointmentIds },
          status: "Paid",
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.json({
      success: true,
      data: {
        doctor: {
          _id: doctor?._id,
          name: doctor?.userId?.fullName || "Unknown",
          email: doctor?.userId?.email || "N/A",
          image: doctor?.userId?.profileImage || null,
          specialization: doctor?.specialization || "N/A",
          doctorId: doctor?.doctorId || "N/A",
        },
        payments,
        statistics: {
          totalRevenue: stats[0]?.totalRevenue || 0,
          totalPayments: stats[0]?.totalPayments || 0,
          monthlyRevenue: monthlyRevenue.map((item) => ({
            month: `${item._id.year}-${String(item._id.month).padStart(
              2,
              "0"
            )}`,
            amount: item.total,
            count: item.count,
          })),
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.log("getPaymentsByDoctor error", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get Comprehensive Analytics for Super Admin
export const getComprehensiveAnalytics = async (req, res) => {
  try {
    const { period = "month" } = req.query; // day, week, month, year
    const now = new Date();

    let startDate, endDate;
    switch (period) {
      case "day":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        endDate = new Date();
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date();
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
    }

    // Hospital Performance Metrics
    const totalPatients = await userModel.countDocuments({ role: "patient" });
    const newPatientsThisPeriod = await userModel.countDocuments({
      role: "patient",
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const totalDoctors = await doctorModel.countDocuments();
    const activeDoctors = await doctorModel.countDocuments({
      status: "available",
    });

    // Appointment Analytics
    const totalAppointments = await Appointment.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const completedAppointments = await Appointment.countDocuments({
      status: "Completed",
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const cancelledAppointments = await Appointment.countDocuments({
      status: "Cancelled",
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const pendingAppointments = await Appointment.countDocuments({
      status: "Pending",
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Revenue Analytics
    const revenueStats = await Payment.aggregate([
      {
        $match: {
          status: "Paid",
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          averagePayment: { $avg: "$amount" },
          totalPayments: { $sum: 1 },
        },
      },
    ]);

    // Daily Revenue Trend (last 30 days)
    const dailyRevenue = await Payment.aggregate([
      {
        $match: {
          status: "Paid",
          createdAt: {
            $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Department Performance
    const departmentStats = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: "doctors",
          localField: "doctor",
          foreignField: "_id",
          as: "doctorData",
        },
      },
      { $unwind: "$doctorData" },
      {
        $lookup: {
          from: "departments",
          localField: "doctorData.department",
          foreignField: "_id",
          as: "departmentData",
        },
      },
      { $unwind: "$departmentData" },
      {
        $group: {
          _id: "$departmentData._id",
          departmentName: { $first: "$departmentData.name" },
          appointmentCount: { $sum: 1 },
          completedCount: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
          },
        },
      },
      { $sort: { appointmentCount: -1 } },
    ]);

    // Patient Demographics
    const patientAgeGroups = await userModel.aggregate([
      {
        $match: { role: "patient", age: { $exists: true } },
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lt: ["$age", 18] }, then: "0-17" },
                { case: { $lt: ["$age", 30] }, then: "18-29" },
                { case: { $lt: ["$age", 45] }, then: "30-44" },
                { case: { $lt: ["$age", 60] }, then: "45-59" },
                { case: { $lt: ["$age", 75] }, then: "60-74" },
              ],
              default: "75+",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Top Performing Doctors
    const topDoctors = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "Completed",
        },
      },
      {
        $group: {
          _id: "$doctor",
          appointmentCount: { $sum: 1 },
        },
      },
      { $sort: { appointmentCount: -1 } },
      { $limit: 10 },
    ]);

    const topDoctorsWithDetails = await Promise.all(
      topDoctors.map(async (item) => {
        const doctor = await doctorModel
          .findById(item._id)
          .populate("userId", "fullName profileImage")
          .select("specialization");
        return {
          doctorId: doctor?._id,
          name: doctor?.userId?.fullName || "Unknown",
          image: doctor?.userId?.profileImage || null,
          specialization: doctor?.specialization || "N/A",
          appointments: item.appointmentCount,
        };
      })
    );

    // Payment Method Distribution
    const paymentMethods = await Payment.aggregate([
      {
        $match: {
          status: "Paid",
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$method",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Appointment Status Distribution
    const appointmentStatusDist = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        period,
        overview: {
          totalPatients,
          newPatients: newPatientsThisPeriod,
          totalDoctors,
          activeDoctors,
          totalAppointments,
          completedAppointments,
          cancelledAppointments,
          pendingAppointments,
          completionRate:
            totalAppointments > 0
              ? ((completedAppointments / totalAppointments) * 100).toFixed(1)
              : 0,
        },
        revenue: {
          total: revenueStats[0]?.totalRevenue || 0,
          average: revenueStats[0]?.averagePayment || 0,
          count: revenueStats[0]?.totalPayments || 0,
          dailyTrend: dailyRevenue.map((item) => ({
            date: `${item._id.year}-${String(item._id.month).padStart(
              2,
              "0"
            )}-${String(item._id.day).padStart(2, "0")}`,
            amount: item.total,
            count: item.count,
          })),
        },
        departments: departmentStats,
        patientDemographics: {
          ageGroups: patientAgeGroups,
        },
        topDoctors: topDoctorsWithDetails,
        paymentMethods,
        appointmentStatus: appointmentStatusDist,
      },
    });
  } catch (error) {
    console.log("getComprehensiveAnalytics error", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Super Admin Dashboard Statistics
export const getSuperAdminDashboard = async (req, res) => {
  try {
    // Get current date ranges
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // User Statistics
    const totalAdmins = await userModel.countDocuments({ role: "admin" });
    const totalDoctors = await userModel.countDocuments({ role: "doctor" });
    const totalReceptionists = await userModel.countDocuments({
      role: "receptionist",
    });
    const totalPatients = await userModel.countDocuments({ role: "patient" });
    const totalStaff = totalAdmins + totalDoctors + totalReceptionists;

    // Doctor Statistics
    const doctorsWithDetails = await doctorModel.countDocuments();
    const availableDoctors = await doctorModel.countDocuments({
      status: "available",
    });
    const unavailableDoctors = await doctorModel.countDocuments({
      status: "unavailable",
    });

    // Department Statistics
    const totalDepartments = await DepartmentModel.countDocuments();

    // Appointment Statistics
    const totalAppointments = await Appointment.countDocuments();
    const todayAppointments = await Appointment.countDocuments({
      appointmentDate: { $gte: startOfToday, $lte: endOfToday },
    });
    const weekAppointments = await Appointment.countDocuments({
      appointmentDate: { $gte: startOfWeek },
    });
    const monthAppointments = await Appointment.countDocuments({
      appointmentDate: { $gte: startOfMonth },
    });

    const appointmentsByStatus = await Appointment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Payment/Income Statistics
    const totalPayments = await Payment.aggregate([
      {
        $match: { status: "Paid" },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const todayPayments = await Payment.aggregate([
      {
        $match: {
          status: "Paid",
          createdAt: { $gte: startOfToday, $lte: endOfToday },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const weekPayments = await Payment.aggregate([
      {
        $match: {
          status: "Paid",
          createdAt: { $gte: startOfWeek },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const monthPayments = await Payment.aggregate([
      {
        $match: {
          status: "Paid",
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const yearPayments = await Payment.aggregate([
      {
        $match: {
          status: "Paid",
          createdAt: { $gte: startOfYear },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Monthly income for last 12 months
    const monthlyIncome = await Payment.aggregate([
      {
        $match: {
          status: "Paid",
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Payment method distribution
    const paymentMethods = await Payment.aggregate([
      {
        $match: { status: "Paid" },
      },
      {
        $group: {
          _id: "$method",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Patient gender distribution
    const patientGender = await userModel.aggregate([
      {
        $match: { role: "patient" },
      },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent appointments (last 10)
    const recentAppointments = await Appointment.find()
      .populate("patient", "fullName email contact")
      .populate("doctor", "specialization")
      .populate({
        path: "doctor",
        populate: { path: "userId", select: "fullName" },
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("appointmentDate timeSlot status consultationType");

    // Top performing doctors (by appointment count)
    const topDoctors = await Appointment.aggregate([
      {
        $group: {
          _id: "$doctor",
          appointmentCount: { $sum: 1 },
        },
      },
      {
        $sort: { appointmentCount: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctorInfo",
        },
      },
      {
        $unwind: "$doctorInfo",
      },
      {
        $lookup: {
          from: "users",
          localField: "doctorInfo.userId",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $project: {
          doctorName: "$userInfo.fullName",
          specialization: "$doctorInfo.specialization",
          appointmentCount: 1,
        },
      },
    ]);

    // Response data
    const dashboardData = {
      overview: {
        totalStaff,
        totalAdmins,
        totalDoctors,
        totalReceptionists,
        totalPatients,
        totalDepartments,
        totalAppointments,
      },
      doctors: {
        total: doctorsWithDetails,
        available: availableDoctors,
        unavailable: unavailableDoctors,
      },
      appointments: {
        total: totalAppointments,
        today: todayAppointments,
        thisWeek: weekAppointments,
        thisMonth: monthAppointments,
        byStatus: appointmentsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
      income: {
        total: totalPayments[0]?.totalAmount || 0,
        totalCount: totalPayments[0]?.count || 0,
        today: todayPayments[0]?.totalAmount || 0,
        todayCount: todayPayments[0]?.count || 0,
        thisWeek: weekPayments[0]?.totalAmount || 0,
        weekCount: weekPayments[0]?.count || 0,
        thisMonth: monthPayments[0]?.totalAmount || 0,
        monthCount: monthPayments[0]?.count || 0,
        thisYear: yearPayments[0]?.totalAmount || 0,
        yearCount: yearPayments[0]?.count || 0,
        monthlyIncome: monthlyIncome.map((item) => ({
          month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
          amount: item.totalAmount,
          count: item.count,
        })),
        byMethod: paymentMethods,
      },
      analytics: {
        patientGender: patientGender,
        topDoctors: topDoctors,
      },
      recentAppointments: recentAppointments,
    };

    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.log("getSuperAdminDashboard error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
