import activityModel from "../../Models/Activity/activity.js";


export const getRecentActivity = async (req, res) => {
  try {
    const doctorId = req.user.id; 

    const activities = await activityModel.find({ doctorId })
      .sort({ createdAt: -1 })  
      .limit(10);               

    // Format for frontend
    const formatted = activities.map((a) => ({
      patientName: a.patientName,
      action: a.action,
      type: a.type,
      timeAgo: formatTimeAgo(a.createdAt), // helper function
      link: `/patients/${a.patientId || ""}`
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// helper to show "30 min ago"
function formatTimeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000; // in seconds
  if (diff < 60) return `${Math.floor(diff)} sec ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} day${diff > 1 ? "s" : ""} ago`;
}
