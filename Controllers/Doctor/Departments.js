import doctorModel from "../../Models/Doctor/DoctorModels";

export const getDeparments = async (req, res) => {
  try {
    const departments = await doctorModel.distinct("department");
    res.status(200).json({ departments });
  } catch (error) {
    console.error("Get Departments Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const getDoctorsByDepartment = async (req, res) => {
  try {
    const { department } = req.params;

    const doctors = await doctorModel
      .find({ department })
      .populate("userId", "fullName email availableDays availableSlots");

    if (!doctors || doctors.length === 0) {
      return res.status(404).json({ message: "No doctors found in this department" });
    }

    res.status(200).json({ doctors });
  } catch (error) {
    console.error("Get Doctors Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};