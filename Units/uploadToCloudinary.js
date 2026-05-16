import cloudinary from "../Config/Cloudinary.js";

export const uploadToCloudinary = (
  fileBuffer,
  folder,
  resourceType = "auto",
) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },

      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    uploadStream.end(fileBuffer);
  });
};
