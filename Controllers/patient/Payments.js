import Payment from "../../Models/Payments/paymentSchema.js";


export const patientGetMyPayments = async (req, res) => {
  try {
    const userId = req.user._id;

    const payments = await Payment.find({ patient: userId }).sort({
      createdAt: -1,
    });

    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
