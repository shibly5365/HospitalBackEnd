import bcrypt from "bcrypt";
import mongoose from "mongoose";
import userModel from "../../Models/User/UserModels.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DepartmentModel from "../../Models/Departmenst/DepartmenstModels.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
import DoctorLeave from "../../Models/LeaveRequest/leaveSchema.js";
import Payment from "../../Models/Payments/paymentSchema.js";
import activityModel from "../../Models/Activity/activity.js";
import { uploadToCloudinary } from "../../Units/uploadToCloudinary.js";
import ReviewModel from "../../Models/Receptionist/Receptionist.js";
import moment from "moment";

// 🔹 Helper: Generate unique doctorId
const generateUniqueDoctorId = async () => {
  const lastDoctor = await doctorModel
    .findOne({ doctorId: { $exists: true } })
    .sort({ createdAt: -1 });
  let doctorId = "DOC-0001";
  if (lastDoctor?.doctorId) {
    const parts = lastDoctor.doctorId.split("-");
    const lastNumber = parts.length === 2 ? parseInt(parts[1], 10) || 0 : 0;
    doctorId = `DOC-${String(lastNumber + 1).padStart(4, "0")}`;
  }
  return doctorId;
};

// 🔹 Helper: Generate slots for a day according to schema
const generateSlots = (
  startTime,
  endTime,
  duration,
  onlineFee = 100,
  offlineFee = 80,
) => {
  const slots = [];
  let start = moment(startTime, "hh:mm A");
  const end = moment(endTime, "hh:mm A");

  while (start.isBefore(end)) {
    let slotEnd = start.clone().add(duration, "minutes");
    if (slotEnd.isAfter(end)) slotEnd = end.clone();

    slots.push({
      start: start.format("hh:mm A"),
      end: slotEnd.format("hh:mm A"),
      duration,
      isBooked: false,
      onlineFee,
      offlineFee,
    });

    start = slotEnd;
  }
  return slots;
};

// 🔹 Helper: Generate DoctorSchedule for next 30 days
const createDoctorSchedule = async (doctor) => {
  for (let i = 0; i < 30; i++) {
    const date = moment().add(i, "days");
    const dayName = date.format("ddd"); // Mon, Tue, etc.

    if (doctor.availableDays.includes(dayName)) {
      const exists = await DoctorSchedule.findOne({
        doctor: doctor._id,
        date: date.toDate(),
      });
      if (!exists) {
        const slots = generateSlots(
          doctor.availableSlots[0].start,
          doctor.availableSlots[0].end,
          doctor.duration,
          doctor.onlineFee || 100,
          doctor.consultationFee || 80,
        );

        await DoctorSchedule.create({
          doctor: doctor._id,
          dayName,
          date: date.toDate(),
          workingHours: {
            start: doctor.availableSlots[0].start,
            end: doctor.availableSlots[0].end,
          },
          slots,
          breaks: doctor.breaks || [],
        });
      }
    }
  }
};

// ================= CREATE DOCTOR =================
export const CreateDoctor = async (req, res) => {
  try {
    const {
      email,
      fullName,
      password,
      contact,
      departmentName,
      specialization,
      qualification,
      experience,
      salary,
      consultationType,
      availableDays,
      availableSlots,
      consultationFee,
      bio,
      status,
      doctorId: requestedDoctorId,
      duration,
      maxPatientsPerDay,
      gender,
      dob,
      address,
      breaks,
    } = req.body;

    // Validate required fields
    if (
      !email ||
      !fullName ||
      !password ||
      !contact ||
      !departmentName ||
      !specialization
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Required fields are missing" });
    }

    // Check if email already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser)
      return res
        .status(400)
        .json({ success: false, message: "Email is already in use" });

    // Check department
    const departmentExist = await DepartmentModel.findOne({
      name: departmentName,
    });
    if (!departmentExist)
      return res
        .status(400)
        .json({ success: false, message: "Invalid department selected" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Profile image
    const profileImageUrl = req.file
      ? (await uploadToCloudinary(req.file.buffer, "Doctors")).secure_url
      : req.body.profileImage ||
        "https://your-default-image-url.com/default-doctor.png";

    // Create user
    const newUser = await userModel.create({
      fullName,
      email,
      password: hashedPassword,
      contact,
      profileImage: profileImageUrl,
      role: "doctor",
      gender,
      dob,
      address,
    });

    // Generate doctorId
    let doctorId = requestedDoctorId;
    if (requestedDoctorId) {
      if (await doctorModel.findOne({ doctorId: requestedDoctorId })) {
        return res
          .status(400)
          .json({ success: false, message: "Doctor ID already in use" });
      }
    } else doctorId = await generateUniqueDoctorId();

    // Parse availableSlots if sent as string
    let parsedAvailableSlots = availableSlots;
    if (typeof availableSlots === "string")
      parsedAvailableSlots = JSON.parse(availableSlots);

    // Create doctor
    const newDoctor = await doctorModel.create({
      userId: newUser._id,
      doctorId,
      department: departmentExist._id,
      departmentName,
      specialization,
      qualification,
      experience,
      salary,
      consultationType,
      availableDays,
      availableSlots: parsedAvailableSlots,
      consultationFee,
      bio,
      status,
      duration: duration || 30,
      maxPatientsPerDay: maxPatientsPerDay || 20,
      breaks: breaks || [],
    });

    // ✅ Generate schedules for next 30 days
    await createDoctorSchedule(newDoctor);

    // Populate doctor response
    const doctorWithUser = await doctorModel
      .findById(newDoctor._id)
      .populate("userId", "-password -resetOtp -verifyOtp")
      .populate("department", "name description");

    res.status(201).json({
      success: true,
      message: "Doctor created successfully",
      doctor: doctorWithUser,
    });
  } catch (error) {
    console.error("Error creating doctor:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= GET ALL DOCTORS =================
export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await doctorModel
      .find()
      .populate({
        path: "userId",
        select: "fullName email role contact profileImage",
      })
      .populate({ path: "department", select: "name description" });
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const doctorSummaries = await Promise.all(
      doctors.map(async (d) => {
        if (d.userId?.role !== "doctor") return null;
        const totalPatients = await Appointment.distinct("patient", {
          doctor: d._id,
        });
        const todaysAppointments = await Appointment.countDocuments({
          doctor: d._id,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        });
        const profileImage = d.userId?.profileImage
          ? typeof d.userId.profileImage === "string"
            ? d.userId.profileImage
            : d.userId.profileImage.url
          : null;
        const reviews = await ReviewModel.find({ doctor: d._id })
          .select("patient rating comment createdAt")
          .populate("patient", "fullName");
        const averageRating =
          reviews.length > 0
            ? (
                reviews.reduce((acc, r) => acc + (r.rating || 0), 0) /
                reviews.length
              ).toFixed(1)
            : 0;

        return {
          _id: d._id,
          doctorId: d.doctorId || "N/A",
          name: d.userId?.fullName || "N/A",
          email: d.userId?.email || "N/A",
          contact: d.userId?.contact || "N/A",
          profileImage,
          department: d.department?.name || "N/A",
          specialization: d.specialization || "N/A",
          qualification: d.qualification || "N/A",
          experience: d.experience ? `${d.experience} years` : "N/A",
          bio: d.bio || "No bio available",
          consultationFee: d.consultationFee || "N/A",
          reviews: reviews.map((r) => ({
            patientName: r.patient?.fullName || "Anonymous",
            rating: r.rating,
            comment: r.comment,
            date: r.createdAt,
          })),
          averageRating,
          totalPatients: totalPatients.length || 0,
          todaysAppointments,
          status: d.status || "unavailable",
        };
      }),
    );

    res.status(200).json({
      success: true,
      count: doctorSummaries.filter(Boolean).length,
      doctors: doctorSummaries.filter(Boolean),
    });
  } catch (error) {
    console.error("getAllDoctors Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ================= GET DOCTOR BY ID =================
export const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await doctorModel
      .findById(id)
      .populate("userId", "fullName email contact profileImage role")
      .populate("department", "name description")
      .lean();
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const profileImage = doctor.userId?.profileImage
      ? typeof doctor.userId.profileImage === "string"
        ? doctor.userId.profileImage
        : doctor.userId.profileImage.url
      : null;
    const reviews = await ReviewModel.find({ doctor: doctor._id })
      .select("patient rating comment createdAt")
      .populate("patient", "fullName");
    const averageRating =
      reviews.length > 0
        ? (
            reviews.reduce((acc, r) => acc + (r.rating || 0), 0) /
            reviews.length
          ).toFixed(1)
        : 0;

    res.status(200).json({
      success: true,
      doctor: {
        _id: doctor._id,
        doctorId: doctor.doctorId || "N/A",
        name: doctor.userId?.fullName || "N/A",
        email: doctor.userId?.email || "N/A",
        contact: doctor.userId?.contact || "N/A",
        profileImage,
        department: doctor.department
          ? { id: doctor.department._id, name: doctor.department.name }
          : { id: null, name: "N/A" },
        specialization: doctor.specialization || "N/A",
        qualification: doctor.qualification || "N/A",
        experience: doctor.experience ? `${doctor.experience} years` : "N/A",
        bio: doctor.bio || "No bio available",
        consultationFee: doctor.consultationFee || "N/A",
        status: doctor.status || "unavailable",
        availableDays: doctor.availableDays || [],
        availableSlots: doctor.availableSlots || [],
        reviews: reviews.map((r) => ({
          patientName: r.patient?.fullName || "Anonymous",
          rating: r.rating,
          comment: r.comment,
          date: r.createdAt,
        })),
        averageRating,
      },
    });
  } catch (error) {
    console.error("getDoctorById Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorsByDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Get doctors of this department
    const doctors = await doctorModel
      .find({ department: id })
      .populate("userId", "fullName email")
      .lean();

    // ✅ Find current HOD
    const headDoctor = doctors.find((d) => d.isHead === true);

    // ✅ Simple doctor list (no heavy data needed)
    const doctorList = doctors.map((d) => ({
      _id: d._id,
      name: d.userId?.fullName || "N/A",
      email: d.userId?.email || "N/A",
      specialization: d.specialization || "N/A",
      isHead: d.isHead || false,
    }));

    // ✅ ALWAYS return success (even if empty)
    res.status(200).json({
      success: true,
      doctors: doctorList,

      // ✅ IMPORTANT → send ONLY ID
      headOfDepartment: headDoctor ? headDoctor._id : null,
    });
  } catch (error) {
    console.error("getDoctorsByDepartment Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= UPDATE DOCTOR =================
export const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await doctorModel.findById(id);
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    const userUpdates = {};
    const doctorUpdates = {};

    const allowedUserFields = [
      "fullName",
      "email",
      "contact",
      "gender",
      "dob",
      "address",
    ];

    const allowedDoctorFields = [
      "specialization",
      "qualification",
      "experience",
      "salary",
      "consultationType",
      "availableDays",
      "availableSlots",
      "consultationFee",
      "bio",
      "status",
      "duration",
      "maxPatientsPerDay",
      "departmentName",
    ];

    // USER FIELDS
    allowedUserFields.forEach((field) => {
      if (req.body[field]) userUpdates[field] = req.body[field];
    });

    // DOCTOR FIELDS
    allowedDoctorFields.forEach((field) => {
      if (req.body[field]) doctorUpdates[field] = req.body[field];
    });

    // Update password
    if (req.body.password)
      userUpdates.password = await bcrypt.hash(req.body.password, 10);

    // =======================
    // ⭐ IMAGE UPDATE FIX ⭐
    // =======================

    // If file upload
    if (req.file) {
      userUpdates.profileImage = (
        await uploadToCloudinary(req.file.buffer, "Doctors")
      ).secure_url;
    }

    // If URL provided
    else if (req.body.profileImage) {
      userUpdates.profileImage = req.body.profileImage;
    }

    // =======================

    // Update user
    await userModel.findByIdAndUpdate(doctor.userId, userUpdates, {
      new: true,
    });

    // Update doctor details
    const updatedDoctor = await doctorModel.findByIdAndUpdate(
      id,
      doctorUpdates,
      { new: true },
    );

    res.status(200).json({
      success: true,
      message: "Doctor updated successfully",
      doctor: updatedDoctor,
    });
  } catch (error) {
    console.error("updateDoctor Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= DELETE DOCTOR =================
export const DeleteDoctors = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await doctorModel
      .findById(id)
      .populate("department", "name");
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    await userModel.findByIdAndDelete(doctor.userId);
    await doctorModel.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Doctor from ${
        doctor.department?.name || "Unknown Department"
      } deleted successfully`,
    });
  } catch (error) {
    console.error("deleteDoctor", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const getPagination = (query) => {
  const page = Math.max(DEFAULT_PAGE, parseInt(query.page || DEFAULT_PAGE, 10));
  const limit = Math.max(
    1,
    Math.min(100, parseInt(query.limit || DEFAULT_LIMIT, 10)),
  );
  return { page, limit, skip: (page - 1) * limit };
};

const getDateRange = (query) => {
  const now = moment.utc();
  const from = query.from
    ? moment.utc(query.from).startOf("day")
    : now.clone().startOf("month");
  const to = query.to ? moment.utc(query.to).endOf("day") : now.endOf("day");

  return {
    fromDate: from.toDate(),
    toDate: to.toDate(),
  };
};

const ensureDoctor = async (doctorId) => {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) return null;

  return doctorModel
    .findById(doctorId)
    .populate("userId", "fullName email contact profileImage gender dob")
    .populate("department", "name")
    .lean();
};



export const getDoctorOverview = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await doctorModel
      .findById(id)
      .populate("userId")
      .populate("department")
      .lean();

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    // 🧠 DATE FILTERS
    const startOfMonth = moment().startOf("month").toDate();
    const endOfMonth = moment().endOf("month").toDate();

    // 🔹 STATS
    const [
      totalPatients,
      patientsThisMonth,
      attendanceDays,
      leaves,
      pendingLeaves,
    ] = await Promise.all([
      Appointment.distinct("patient", { doctor: id }),

      Appointment.distinct("patient", {
        doctor: id,
        appointmentDate: { $gte: startOfMonth, $lte: endOfMonth },
      }),

      Appointment.distinct("appointmentDate", {
        doctor: id,
        status: { $in: ["Completed", "With-Doctor"] },
      }),

      DoctorLeave.countDocuments({ doctor: id }),

      DoctorLeave.countDocuments({ doctor: id, status: "pending" }),
    ]);

    // 🔹 PROFILE IMAGE FIX
    const profileImage = doctor.userId?.profileImage
      ? typeof doctor.userId.profileImage === "string"
        ? doctor.userId.profileImage
        : doctor.userId.profileImage.url
      : null;

    // 🔹 RESPONSE
    res.status(200).json({
      success: true,

      // 🟦 TOP CARDS
      stats: {
        totalPatients: totalPatients.length,
        patientsThisMonth: patientsThisMonth.length,
        daysPresent: attendanceDays.length,
        totalLeaves: leaves,
        pendingLeaves,
      },

      // 🟩 BASIC INFO
      basicInfo: {
        name: doctor.userId?.fullName || "N/A",
        doctorId: doctor.doctorId || "N/A",
        department: doctor.department?.name || "N/A",
        email: doctor.userId?.email || "N/A",
        phone: doctor.userId?.contact || "N/A",
        address: doctor.userId?.address || "N/A",
        gender: doctor.userId?.gender || "N/A",
        dob: doctor.userId?.dob || "N/A",
        profileImage,
      },

      // 🟨 PROFESSIONAL INFO
      professionalInfo: {
        qualification: doctor.qualification || "N/A",
        specialization: doctor.specialization || "N/A",
        experience: doctor.experience
          ? `${doctor.experience} years`
          : "N/A",
        certifications: doctor.certifications || "No certifications listed",
        consultationType: doctor.consultationType || "N/A",
        salary: doctor.salary ? `$${doctor.salary}/year` : "N/A",
      },

      // 🟪 AVAILABILITY
      availability: {
        workingDays: doctor.availableDays || [],
        shiftTimings:
          doctor.availableSlots?.length > 0
            ? `${doctor.availableSlots[0].start} - ${doctor.availableSlots[0].end}`
            : "N/A",
        status: doctor.status || "unavailable",
      },
    });
  } catch (error) {
    console.error("getDoctorOverview error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminDoctorPatients = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await ensureDoctor(id);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    const { page, limit, skip } = getPagination(req.query);
    const { fromDate, toDate } = getDateRange(req.query);
    const search = (req.query.search || "").trim();

    const matchStage = {
      doctor: toObjectId(id),
      appointmentDate: { $gte: fromDate, $lte: toDate },
      status: { $ne: "Cancelled" },
    };

    const searchMatch = search
      ? {
          $or: [
            { "patient.fullName": { $regex: search, $options: "i" } },
            { "patient.email": { $regex: search, $options: "i" } },
            { "patient.contact": { $regex: search, $options: "i" } },
            { "patient.patientId": { $regex: search, $options: "i" } },
          ],
        }
      : null;

    const results = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$patient",
          totalVisits: { $sum: 1 },
          completedVisits: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
          },
          pendingVisits: {
            $sum: {
              $cond: [{ $in: ["$status", ["Pending", "Confirmed"]] }, 1, 0],
            },
          },
          lastVisit: { $max: "$appointmentDate" },
          firstVisit: { $min: "$appointmentDate" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: "$patient" },
      ...(searchMatch ? [{ $match: searchMatch }] : []),
      {
        $project: {
          _id: 0,
          patientId: "$patient._id",
          name: "$patient.fullName",
          email: "$patient.email",
          contact: "$patient.contact",
          profileImage: "$patient.profileImage",
          patientUniqueId: "$patient.patientId",
          totalVisits: 1,
          completedVisits: 1,
          pendingVisits: 1,
          firstVisit: 1,
          lastVisit: 1,
        },
      },
      { $sort: { lastVisit: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    const total = results[0]?.metadata?.[0]?.total || 0;
    const data = results[0]?.data || [];

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      data,
    });
  } catch (error) {
    console.error("getAdminDoctorPatients error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminDoctorAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await ensureDoctor(id);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    const { fromDate, toDate } = getDateRange(req.query);
    const todayStart = moment.utc().startOf("day").toDate();

    const schedules = await DoctorSchedule.find({
      doctor: id,
      date: { $gte: fromDate, $lte: toDate },
    })
      .sort({ date: 1 })
      .lean();

    const appointmentDays = await Appointment.aggregate([
      {
        $match: {
          doctor: toObjectId(id),
          appointmentDate: { $gte: fromDate, $lte: toDate },
          status: { $in: ["Completed", "With-Doctor", "Confirmed"] },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$appointmentDate" },
          },
          appointments: { $sum: 1 },
        },
      },
    ]);

    const appointmentMap = new Map(
      appointmentDays.map((d) => [d._id, d.appointments]),
    );

    const dayWise = schedules.map((s) => {
      const dayKey = moment.utc(s.date).format("YYYY-MM-DD");
      const hasConsultation = (appointmentMap.get(dayKey) || 0) > 0;
      const isPast = new Date(s.date) < todayStart;

      let attendanceStatus = "upcoming";
      if (s.isLeaveDay) attendanceStatus = "leave";
      else if (isPast && hasConsultation) attendanceStatus = "present";
      else if (isPast && !hasConsultation) attendanceStatus = "absent";

      const bookedSlots = (s.slots || []).filter(
        (slot) => slot.isBooked,
      ).length;

      return {
        date: s.date,
        dayName: s.dayName,
        workingHours: s.workingHours,
        attendanceStatus,
        totalSlots: (s.slots || []).length,
        bookedSlots,
      };
    });

    const summary = dayWise.reduce(
      (acc, day) => {
        acc.totalDays += 1;
        if (day.attendanceStatus === "present") acc.presentDays += 1;
        if (day.attendanceStatus === "absent") acc.absentDays += 1;
        if (day.attendanceStatus === "leave") acc.leaveDays += 1;
        if (day.attendanceStatus === "upcoming") acc.upcomingDays += 1;
        acc.totalSlots += day.totalSlots;
        acc.bookedSlots += day.bookedSlots;
        return acc;
      },
      {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        leaveDays: 0,
        upcomingDays: 0,
        totalSlots: 0,
        bookedSlots: 0,
      },
    );

    const denominator = summary.presentDays + summary.absentDays;
    summary.attendanceRate = denominator
      ? Number(((summary.presentDays / denominator) * 100).toFixed(2))
      : 0;

    return res.status(200).json({
      success: true,
      summary,
      data: dayWise,
    });
  } catch (error) {
    console.error("getAdminDoctorAttendance error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminDoctorLeaves = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await ensureDoctor(id);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    const { page, limit, skip } = getPagination(req.query);
    const { fromDate, toDate } = getDateRange(req.query);
    const status = (req.query.status || "").trim();
    const type = (req.query.type || "").trim();

    const filter = {
      doctor: id,
      startDate: { $lte: toDate },
      endDate: { $gte: fromDate },
    };

    if (status && status !== "all") filter.status = status;
    if (type && type !== "all") filter.type = type;

    const [leaves, total, grouped] = await Promise.all([
      DoctorLeave.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DoctorLeave.countDocuments(filter),
      DoctorLeave.aggregate([
        { $match: { doctor: toObjectId(id) } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalDays: { $sum: "$totalDays" },
          },
        },
      ]),
    ]);

    const summary = {
      pending: 0,
      approved: 0,
      rejected: 0,
      totalLeaveDays: 0,
    };

    grouped.forEach((g) => {
      if (Object.prototype.hasOwnProperty.call(summary, g._id)) {
        summary[g._id] = g.count;
      }
      summary.totalLeaveDays += g.totalDays || 0;
    });

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      summary,
      data: leaves,
    });
  } catch (error) {
    console.error("getAdminDoctorLeaves error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminDoctorPayments = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await ensureDoctor(id);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    const { page, limit, skip } = getPagination(req.query);
    const { fromDate, toDate } = getDateRange(req.query);
    const status = (req.query.status || "").trim();
    const method = (req.query.method || "").trim();
    const search = (req.query.search || "").trim();

    const basePipeline = [
      {
        $lookup: {
          from: "appointments",
          localField: "appointment",
          foreignField: "_id",
          as: "appointmentDoc",
        },
      },
      {
        $addFields: {
          resolvedDoctor: {
            $ifNull: [
              "$doctor",
              { $arrayElemAt: ["$appointmentDoc.doctor", 0] },
            ],
          },
        },
      },
      {
        $match: {
          resolvedDoctor: toObjectId(id),
          createdAt: { $gte: fromDate, $lte: toDate },
        },
      },
    ];

    if (status && status !== "all") {
      basePipeline.push({ $match: { status } });
    }

    if (method && method !== "all") {
      basePipeline.push({ $match: { method } });
    }

    if (search) {
      basePipeline.push({
        $match: { paymentId: { $regex: search, $options: "i" } },
      });
    }

    const results = await Payment.aggregate([
      ...basePipeline,
      {
        $lookup: {
          from: "users",
          localField: "patient",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          paymentId: 1,
          amount: 1,
          method: 1,
          status: 1,
          channel: 1,
          type: 1,
          createdAt: 1,
          patient: {
            _id: "$patient._id",
            fullName: "$patient.fullName",
            patientId: "$patient.patientId",
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    const summaryAgg = await Payment.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          paidAmount: {
            $sum: { $cond: [{ $eq: ["$status", "Paid"] }, "$amount", 0] },
          },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ["$status", "Pending"] }, "$amount", 0] },
          },
          refundedAmount: {
            $sum: { $cond: [{ $eq: ["$status", "Refunded"] }, "$amount", 0] },
          },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    const total = results[0]?.metadata?.[0]?.total || 0;
    const data = results[0]?.data || [];

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      summary: summaryAgg[0] || {
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        refundedAmount: 0,
        totalTransactions: 0,
      },
      data,
    });
  } catch (error) {
    console.error("getAdminDoctorPayments error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminDoctorActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await ensureDoctor(id);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    const { page, limit, skip } = getPagination(req.query);

    const rawActivities = await activityModel
      .find({ doctorId: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    let data = rawActivities.map((a) => ({
      _id: a._id,
      action: a.action,
      type: a.type,
      patientId: a.patientId || null,
      patientName: a.patientName || "N/A",
      createdAt: a.createdAt,
    }));

    if (!data.length) {
      const fallback = await Appointment.find({ doctor: id })
        .populate("patient", "fullName")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("status updatedAt appointmentDate patient consultationType")
        .lean();

      data = fallback.map((a) => ({
        _id: a._id,
        action: `Appointment ${a.status}`,
        type: "appointment",
        patientId: a.patient?._id || null,
        patientName: a.patient?.fullName || "N/A",
        createdAt: a.updatedAt || a.appointmentDate,
      }));
    }

    return res.status(200).json({
      success: true,
      page,
      limit,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getAdminDoctorActivity error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔹 Get all schedules
    const schedules = await DoctorSchedule.find({ doctor: id }).lean();

    // 🔹 Get appointments for doctor
    const appointments = await Appointment.find({
      doctor: id,
      status: { $in: ["Completed", "With-Doctor"] },
    }).select("appointmentDate").lean();

    // 🔹 Convert appointments into date map for fast lookup
    const appointmentMap = new Set(
      appointments.map((a) =>
        new Date(a.appointmentDate).toDateString()
      )
    );

    // 🔹 Build attendance
    const data = schedules.map((s) => {
      const dateStr = new Date(s.date).toDateString();

      // 🔴 Leave day
      if (s.isLeaveDay) {
        return {
          date: s.date,
          status: "leave",
        };
      }

      // 🟡 Half-day (based on schedule)
      if (
        s.workType === "Half Day - Morning" ||
        s.workType === "Half Day - Afternoon"
      ) {
        return {
          date: s.date,
          status: "half-day",
        };
      }

      // 🟢 Present (if appointment exists)
      if (appointmentMap.has(dateStr)) {
        return {
          date: s.date,
          status: "present",
        };
      }

      // 🔴 Absent (default)
      return {
        date: s.date,
        status: "absent",
      };
    });

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("getDoctorAttendance error:", err);
    res.status(500).json({ success: false });
  }
};