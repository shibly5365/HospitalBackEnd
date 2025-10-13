import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },

    treatments: [
      {
        title: { type: String, required: true },
        description: { type: String },
      },
    ],

    headOfDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    image: { type: String },

    doctorsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const DepartmentModle = mongoose.model("department", departmentSchema);
export default DepartmentModle;
