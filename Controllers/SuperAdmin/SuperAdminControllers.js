import userModel from "../../Models/User/UserModels.js";
import bcrypt from "bcrypt";

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
