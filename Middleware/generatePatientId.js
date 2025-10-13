// middlewares/patientId.middleware.js

export async function generatePatientId(next) {
  if (this.isNew && this.role === "patient" && !this.patientId) {
    try {
      // Find last created patient
      const lastPatient = await this.constructor
        .findOne({ role: "patient" })
        .sort({ createdAt: -1 })
        .select("+patientId");

      let newIdNumber = 1;

      if (lastPatient?.patientId) {
        // Extract the numeric part: PAT-000123 → 123
        const lastNumber = parseInt(lastPatient.patientId.split("-")[1], 10);
        newIdNumber = lastNumber + 1;
      }

      // Generate new patient ID like PAT-000001
      this.patientId = `PNT-${String(newIdNumber).padStart(3, "0")}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
}
