import bcrypt from "bcrypt";
import userModel from "../../Models/User/UserModels.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import DepartmentModel from "../../Models/Departmenst/DepartmenstModels.js";
import Appointment from "../../Models/Appointment/Appointment.js";
import { uploadToCloudinary } from "../../Units/uploadToCloudinary.js";
import ReviewModel from "../../Models/Receptionist/Receptionist.js";

// 🔹 Helper function to generate unique doctorId
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
    } = req.body;

    // 1️⃣ Check required fields
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

    // 2️⃣ Check for duplicate email
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email is already in use" });
    }

    // 3️⃣ Validate department
    const departmentExist = await DepartmentModel.findOne({
      name: departmentName,
    });
    if (!departmentExist) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid department selected" });
    }

    // 4️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

  let profileImageUrl = null;

// 1️⃣ File uploaded via multipart/form-data
if (req.file) {
  try {
    const result = await uploadToCloudinary(req.file.buffer, "Doctors");
    profileImageUrl = result.secure_url;
  } catch (uploadError) {
    console.error("Cloudinary upload failed:", uploadError);
    return res.status(500).json({ success: false, message: "Image upload failed" });
  }
}
// 2️⃣ URL provided in JSON body
else if (req.body.profileImage) {
  profileImageUrl = req.body.profileImage;
}
// 3️⃣ Default fallback
else {
  profileImageUrl = "https://your-default-image-url.com/default-doctor.png";
}


    // 6️⃣ Create user
    const newUser = await userModel.create({
      fullName,
      email,
      password: hashedPassword,
      contact,
      profileImage: profileImageUrl,
      role: "doctor",
    });

    // 7️⃣ Doctor ID
    let doctorId = requestedDoctorId;
    if (requestedDoctorId) {
      const exists = await doctorModel.findOne({ doctorId: requestedDoctorId });
      if (exists) {
        return res
          .status(400)
          .json({ success: false, message: "Doctor ID already in use" });
      }
    } else {
      doctorId = await generateUniqueDoctorId();
    }

    // 8️⃣ Parse availableSlots if sent as string
    let parsedAvailableSlots = availableSlots;
    if (typeof availableSlots === "string") {
      try {
        parsedAvailableSlots = JSON.parse(availableSlots);
      } catch (err) {
        return res
          .status(400)
          .json({
            success: false,
            message: "availableSlots must be a valid JSON array",
          });
      }
    }

    // 9️⃣ Create Doctor
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
    });

    // 🔟 Populate and return
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
      .populate({
        path: "department",
        select: "name description",
      });

    // Define time range for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const doctorSummaries = await Promise.all(
      doctors.map(async (d) => {
        if (d.userId?.role !== "doctor") return null;

        // Distinct total patients
        const totalPatients = await Appointment.distinct("patient", {
          doctor: d._id,
        });

        // Today's appointment count
        const todaysAppointments = await Appointment.countDocuments({
          doctor: d._id,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        });

        // Handle profile image logic
        let profileImage = null;
        if (d.userId?.profileImage) {
          if (typeof d.userId.profileImage === "string") {
            profileImage = d.userId.profileImage;
          } else if (d.userId.profileImage.url) {
            profileImage = d.userId.profileImage.url;
          }
        }

        // === 🔹 NEW SECTION: Get Reviews & Ratings ===
        const reviews = await ReviewModel.find({ doctor: d._id }).select(
          "patient rating comment createdAt"
        ).populate("patient", "fullName");

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

          // === 🔹 NEW FIELDS ===
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


// ================= UPDATE DOCTOR =================
export const UpdatedAdmin = async (req, res) => {
  try {
    const doctorIdParam = req.params.id;
    const {
      fullName,
      department,
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
      generateNewId,
    } = req.body;

    const doctor = await doctorModel.findById(doctorIdParam);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    // 🔹 Update user's name and profile image
    const userUpdate = {};
    if (fullName) userUpdate.fullName = fullName;

    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          "Doctors"
        );
        userUpdate.profileImage = uploadResult.secure_url;
      } catch (uploadErr) {
        console.error("Image upload failed:", uploadErr);
        return res
          .status(500)
          .json({ success: false, message: "Profile image upload failed" });
      }
    }

    if (Object.keys(userUpdate).length > 0) {
      await userModel.findByIdAndUpdate(doctor.userId, userUpdate, {
        new: true,
      });
    }

    // 🔹 Department update
    let departmentId = doctor.department;
    if (department) {
      const dept = await DepartmentModel.findById(department);
      if (!dept)
        return res.status(400).json({ message: "Invalid department selected" });
      departmentId = dept._id;
    }

    // 🔹 Doctor ID logic
    let finalDoctorId = doctor.doctorId;
    if (requestedDoctorId) {
      const exists = await doctorModel.findOne({ doctorId: requestedDoctorId });
      if (exists && String(exists._id) !== String(doctor._id)) {
        return res
          .status(400)
          .json({ message: "Doctor ID already in use. Choose another." });
      }
      finalDoctorId = requestedDoctorId;
    } else if (!finalDoctorId || generateNewId) {
      finalDoctorId = await generateUniqueDoctorId();
    }

    // 🔹 Update doctor details
    const updatedDoctor = await doctorModel
      .findByIdAndUpdate(
        doctorIdParam,
        {
          doctorId: finalDoctorId,
          department: departmentId,
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
        },
        { new: true }
      )
      .populate("userId", "fullName email contact profileImage role") // ✅ include image
      .populate("department", "name description");

    res.json({
      success: true,
      message: "Doctor updated successfully",
      doctor: updatedDoctor,
    });
  } catch (error) {
    console.error("Update Doctor Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorsByDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const doctors = await doctorModel
      .find({ department: id })
      .populate("userId", "fullName email contact profileImage role")
      .populate("department", "name")
      .lean();

    if (!doctors.length) {
      return res
        .status(404)
        .json({ success: false, message: "No doctors found" });
    }

    const doctorSummaries = await Promise.all(
      doctors.map(async (d) => {
        if (d.userId?.role !== "doctor") return null;

        // Handle profileImage
        let profileImage = null;
        if (d.userId?.profileImage) {
          if (typeof d.userId.profileImage === "string") {
            profileImage = d.userId.profileImage;
          } else if (d.userId.profileImage.url) {
            profileImage = d.userId.profileImage.url;
          }
        }

        // Fetch reviews and compute average rating
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
          reviews: reviews.map((r) => ({
            patientName: r.patient?.fullName || "Anonymous",
            rating: r.rating,
            comment: r.comment,
            date: r.createdAt,
          })),
          averageRating,

          // New: Available days and time slots
          availableDays: d.availableDays || [],
          availableSlots: d.availableSlots || [], // array of { day, slots }
        };
      })
    );

    res.status(200).json({
      success: true,
      count: doctorSummaries.filter(Boolean).length,
      doctors: doctorSummaries.filter(Boolean),
    });
  } catch (error) {
    console.error("getDoctorsByDepartment Error:", error);
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
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

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

// export const updateDoctorSchedule = async (req, res) => {
//   try {
//     const doctorId = req.params.id; // Doctor _id
//     const { availableDays, availableSlots, unavailableDays } = req.body;

//     // Fetch doctor
//     const doctor = await doctorModel.findById(doctorId);
//     if (!doctor) {
//       return res.status(404).json({ success: false, message: "Doctor not found" });
//     }

//     // Authorization check
//     // Admin can update anyone; doctor can update only their own schedule
//     if (req.user.role === "doctor" && doctor.userId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: "Forbidden" });
//     }

//     // Update schedule
//     if (availableDays) doctor.availableDays = availableDays;
//     if (availableSlots) doctor.availableSlots = availableSlots;
//     if (unavailableDays) doctor.unavailableDays = unavailableDays;

//     await doctor.save();

//     res.status(200).json({
//       success: true,
//       message: "Schedule updated successfully",
//       doctor,
//     });
//   } catch (error) {
//     console.error("Error updating schedule:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
