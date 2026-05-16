/**
 * Standardized API Response Wrapper
 * Ensures consistent response format across all endpoints
 */

export class ApiResponse {
  constructor(statusCode, data = null, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Send response via Express
   */
  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      statusCode: this.statusCode,
      data: this.data,
      message: this.message,
      timestamp: this.timestamp,
    });
  }
}

/**
 * Success response
 */
export const successResponse = (res, data, message = "Success", statusCode = 200) => {
  return new ApiResponse(statusCode, data, message).send(res);
};

/**
 * Error response
 */
export const errorResponse = (res, message, statusCode = 500, details = null) => {
  const response = {
    success: false,
    statusCode,
    message,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

/**
 * Paginated response
 */
export const paginatedResponse = (
  res,
  data,
  pagination,
  message = "Success",
  statusCode = 200
) => {
  const response = new ApiResponse(statusCode, data, message);
  response.pagination = pagination;
  return res.status(statusCode).json({
    success: response.success,
    statusCode: response.statusCode,
    data: response.data,
    message: response.message,
    pagination: response.pagination,
    timestamp: response.timestamp,
  });
};

export default {
  ApiResponse,
  successResponse,
  errorResponse,
  paginatedResponse,
};
