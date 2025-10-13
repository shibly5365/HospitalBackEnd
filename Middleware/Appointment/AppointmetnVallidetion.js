export const validateAppointment = (req, res, next) => {
  const { doctorId, appointmentDate, timeSlot, consultationType } = req.body;
  // console.log(doctorId);
  

  if (!doctorId)
    return res.status(400).json({ message: "Doctor ID is required" });
  if (!appointmentDate)
    return res.status(400).json({ message: "Appointment date is required" });
  if (!timeSlot)
    return res.status(400).json({ message: "Time slot is required" });

  if (consultationType && !["Online", "Offline"].includes(consultationType)) {
    return res
      .status(400)
      .json({ message: "Consultation type must be Online or Offline" });
  }

  next();
};
