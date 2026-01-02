import Prescription from "../../Models/prescription/prescription.js";


export const patientGetAllPrescriptions = async (req, res) => {
  try {
    const patientId = req.user._id;

    const prescriptions = await Prescription.find({ patient: patientId })
      .populate("doctor")
      .populate("medicalRecord");

    res.json({ success: true, prescriptions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// 🟢 PATIENT: Get Prescription by ID
export const patientGetPrescriptionById = async (req, res) => {
  try {
    const patientId = req.user._id;
    const { id } = req.params;

    const prescription = await Prescription.findById(id)
      .populate("doctor")
      .populate("medicalRecord");

    if (!prescription)
      return res.status(404).json({ success: false, message: "Not found" });

    if (prescription.patient.toString() !== patientId.toString())
      return res.status(403).json({ success: false, message: "Unauthorized patient" });

    res.json({ success: true, prescription });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

