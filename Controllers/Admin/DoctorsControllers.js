import bcrypt from "bcrypt";
import userModel from "../../Models/User/UserModels.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DepartmentModel from "../../Models/Departmenst/DepartmenstModels.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import { uploadToCloudinary } from "../../Units/uploadToCloudinary.js";
import ReviewModel from "../../Models/Receptionist/Receptionist.js";
import DoctorSchedule from "../../Models/Doctor/ScheduleSchema.js";
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
const generateSlots = (startTime, endTime, duration, onlineFee = 100, offlineFee = 80) => {
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
      const exists = await DoctorSchedule.findOne({ doctor: doctor._id, date: date.toDate() });
      if (!exists) {
        const slots = generateSlots(
          doctor.availableSlots[0].start,
          doctor.availableSlots[0].end,
          doctor.duration,
          doctor.onlineFee || 100,
          doctor.consultationFee || 80
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
    if (!email || !fullName || !password || !contact || !departmentName || !specialization) {
      return res.status(400).json({ success: false, message: "Required fields are missing" });
    }

    // Check if email already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: "Email is already in use" });

    // Check department
    const departmentExist = await DepartmentModel.findOne({ name: departmentName });
    if (!departmentExist) return res.status(400).json({ success: false, message: "Invalid department selected" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Profile image
    const profileImageUrl = req.file
      ? (await uploadToCloudinary(req.file.buffer, "Doctors")).secure_url
      : req.body.profileImage || "https://your-default-image-url.com/default-doctor.png";

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
        return res.status(400).json({ success: false, message: "Doctor ID already in use" });
      }
    } else doctorId = await generateUniqueDoctorId();

    // Parse availableSlots if sent as string
    let parsedAvailableSlots = availableSlots;
    if (typeof availableSlots === "string") parsedAvailableSlots = JSON.parse(availableSlots);

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
      })
    );

    res
      .status(200)
      .json({
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

// ================= GET DOCTORS BY DEPARTMENT =================
export const getDoctorsByDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const doctors = await doctorModel
      .find({ department: id })
      .populate("userId", "fullName email contact profileImage role")
      .populate("department", "name")
      .lean();
    if (!doctors.length)
      return res
        .status(404)
        .json({
          success: false,
          message: "No doctors found in this department",
        });

    const doctorSummaries = await Promise.all(
      doctors.map(async (d) => {
        if (d.userId?.role !== "doctor") return null;
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
          department: d.department
            ? { id: d.department._id, name: d.department.name }
            : { id: null, name: "N/A" },
          specialization: d.specialization || "N/A",
          qualification: d.qualification || "N/A",
          experience: d.experience ? `${d.experience} years` : "N/A",
          bio: d.bio || "No bio available",
          consultationFee: d.consultationFee || "N/A",
          status: d.status || "unavailable",
          availableDays: d.availableDays || [],
          availableSlots: d.availableSlots || [],
          reviews: reviews.map((r) => ({
            patientName: r.patient?.fullName || "Anonymous",
            rating: r.rating,
            comment: r.comment,
            date: r.createdAt,
          })),
          averageRating,
        };
      })
    );

    res
      .status(200)
      .json({
        success: true,
        count: doctorSummaries.filter(Boolean).length,
        doctors: doctorSummaries.filter(Boolean),
      });
  } catch (error) {
    console.error("getDoctorsByDepartment Error:", error);
    res.status(500).json({ success: false, message: error.message });
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
      { new: true }
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
