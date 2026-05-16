import cloudinary from "../../Config/Cloudinary.js";
import DepartmentModle from "../../Models/Departmenst/DepartmenstModels.js";
import doctorModel from "../../Models/Doctor/DoctorModels.js";
import userModel from "../../Models/User/UserModels.js";
import { uploadToCloudinary } from "../../Units/uploadToCloudinary.js";

// 🟢 Create Department with Cloudinary Image
export const createDepartment = async (req, res) => {
  try {
    let imageUrl = "";

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "departments");
      imageUrl = result.secure_url;
    }

    let head = null;

    // ✅ If head provided
    if (req.body.headOfDepartment) {
      const doctor = await doctorModel.findOne({
        userId: req.body.headOfDepartment,
      });

      if (!doctor) {
        return res.status(400).json({
          success: false,
          message: "Head must be a valid doctor",
        });
      }

      head = req.body.headOfDepartment;
    }

    const department = await DepartmentModle.create({
      name: req.body.name,
      description: req.body.description,
      headOfDepartment: head,
      departmentImage: imageUrl,
    });

    res.status(201).json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🟢 Get All Departments
export const getDepartments = async (req, res) => {
  try {
    const departments = await DepartmentModle.find().populate(
      "headOfDepartment",
      "fullName email role",
    );

    const data = await Promise.all(
      departments.map(async (dept) => {
        const doctors = await doctorModel
          .find({ department: dept._id })
          .select("-__v");

        const doctorsWithUser = await Promise.all(
          doctors.map(async (doc) => {
            const user = await userModel
              .findById(doc.userId)
              .select("fullName email contact profileImage role");

            let profileImage = null;

            if (user?.profileImage) {
              profileImage = user.profileImage; // existing image
            } else if (user?.fullName) {
              // Generate a simple placeholder using initials
              const initials = user.fullName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase();

              profileImage = `data:image/svg+xml;base64,${Buffer.from(
                `
                <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
                  <rect width="100" height="100" fill="#c4c4c4"/>
                  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="40" fill="#fff">${initials}</text>
                </svg>
              `,
              ).toString("base64")}`;
            }

            return {
              ...doc.toObject(),
              userId:
                {
                  ...user?.toObject(),
                  profileImage,
                } || null,
            };
          }),
        );

        // Collect all doctor profile images for the department
        const doctorsImg = doctorsWithUser.map(
          (d) => d.userId?.profileImage || null,
        );

        return {
          ...dept.toObject(),
          departmentImage: dept.departmentImage || dept.image || null,
          doctors: doctorsWithUser,
          doctorsImg,
          doctorsCount: doctorsWithUser.length,
        };
      }),
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🟢 Get Department by ID
export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid department ID" });
    }

    const department = await DepartmentModle.findById(id).populate(
      "headOfDepartment",
      "fullName email role",
    );

    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    const doctors = await doctorModel
      .find({ department: id })
      .populate("userId", "fullName email profileImage")
      .lean();

    // Map doctors and generate profile image if missing
    const doctorsList = doctors.map((doc) => {
      let profileImage = null;

      if (doc.userId?.profileImage) {
        profileImage = doc.userId.profileImage; // existing image
      } else if (doc.userId?.fullName) {
        // Generate placeholder initials image
        const initials = doc.userId.fullName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase();

        profileImage = `data:image/svg+xml;base64,${Buffer.from(
          `
          <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
            <rect width="100" height="100" fill="#c4c4c4"/>
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="40" fill="#fff">${initials}</text>
          </svg>
        `,
        ).toString("base64")}`;
      }

      return {
        id: doc._id,
        fullName: doc.userId?.fullName || "Unknown",
        email: doc.userId?.email || "N/A",
        specialization: doc.specialization || "N/A",
        availableDays: doc.availableDays || [],
        status: doc.status || "N/A",
        profileImage,
      };
    });

    // Collect all doctor images for department
    const doctorsImg = doctorsList.map((d) => d.profileImage);

    res.status(200).json({
      success: true,
      department: {
        ...department.toObject(),
        departmentImage: department.departmentImage || null,
        doctorsCount: doctorsList.length,
        doctors: doctorsList,
        doctorsImg,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🟢 Update Department (supports Cloudinary re-upload)
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = {};

    // ✅ Check department exists
    const department = await DepartmentModle.findById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    // =========================
    // ✅ NORMAL FIELD UPDATES
    // =========================
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.description) updateData.description = req.body.description;

    // =========================
    // ✅ HEAD OF DEPARTMENT LOGIC
    // =========================

    // 👉 CASE 1: Remove head
    if (req.body.headOfDepartment === null) {
      updateData.headOfDepartment = null;
    }

    // 👉 CASE 2: Set / Change head
    if (
      req.body.headOfDepartment &&
      req.body.headOfDepartment !== "null" &&
      req.body.headOfDepartment !== ""
    ) {
      const doctor = await doctorModel.findById(req.body.headOfDepartment);

      if (!doctor) {
        return res.status(400).json({
          success: false,
          message: "Head must be a valid doctor",
        });
      }

      if (doctor.department.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: "Doctor not in this department",
        });
      }

      // ✅ FIX HERE
      updateData.headOfDepartment = doctor.userId;
    }
    // =========================
    // ✅ IMAGE UPDATE (MERGED)
    // =========================
    if (req.file) {
      // 🗑️ Delete old image
      if (department.departmentImage) {
        const parts = department.departmentImage.split("/");
        const filename = parts[parts.length - 1].split(".")[0];

        try {
          await cloudinary.uploader.destroy(`departments/${filename}`);
        } catch (err) {
          console.warn("Old image delete failed:", err.message);
        }
      }

      // ☁️ Upload new image
      const result = await uploadToCloudinary(req.file.buffer, "departments");

      updateData.departmentImage = result.secure_url;
    }

    // =========================
    // ✅ FINAL UPDATE
    // =========================
    const updatedDepartment = await DepartmentModle.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    );

    res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: updatedDepartment,
    });
  } catch (error) {
    console.error("Update Department Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 🟢 Delete Department
export const deleteDepartment = async (req, res) => {
  try {
    const department = await DepartmentModle.findByIdAndDelete(req.params.id);

    if (!department)
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });

    res.status(200).json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
