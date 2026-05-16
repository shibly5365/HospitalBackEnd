import Notification from "../Models/notification/NotificationModel.js";
import logger from "../Config/logger.js";
import redisService from "../Units/redisService.js";

/**
 * Notification Service
 * Handles all notification operations - creation, retrieval, updates
 */

class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification({
    recipientId,
    type,
    title,
    message,
    senderId = null,
    resourceType = null,
    resourceId = null,
    priority = "medium",
    metadata = {},
  }) {
    try {
      const notification = await Notification.create({
        recipient: recipientId,
        sender: senderId,
        type,
        title,
        message,
        relatedResource:
          resourceType && resourceId
            ? {
                resourceType,
                resourceId,
              }
            : undefined,
        priority,
        metadata,
      });

      logger.info("Notification created", {
        notificationId: notification._id,
        recipientId,
        type,
      });

      // Invalidate unread count cache
      await this.invalidateUnreadCountCache(recipientId);

      return notification;
    } catch (error) {
      logger.error("Failed to create notification", {
        error: error.message,
        recipientId,
        type,
      });
      throw error;
    }
  }

  /**
   * Create multiple notifications (bulk)
   * Useful for group notifications
   */
  async createBulkNotifications(notifications) {
    try {
      const created = await Notification.insertMany(notifications);

      // Invalidate cache for all recipients
      const recipientIds = [...new Set(notifications.map((n) => n.recipient))];
      for (const recipientId of recipientIds) {
        await this.invalidateUnreadCountCache(recipientId);
      }

      logger.info("Bulk notifications created", {
        count: created.length,
      });

      return created;
    } catch (error) {
      logger.error("Failed to create bulk notifications", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId, limit = 20) {
    try {
      const notifications = await Notification.find({
        recipient: userId,
        isRead: false,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return notifications;
    } catch (error) {
      logger.error("Failed to get unread notifications", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all notifications (paginated)
   */
  async getAllNotifications(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const [notifications, total] = await Promise.all([
        Notification.find({
          recipient: userId,
          isDeleted: false,
        })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Notification.countDocuments({
          recipient: userId,
          isDeleted: false,
        }),
      ]);

      return {
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get all notifications", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        {
          isRead: true,
          readAt: new Date(),
        },
        { new: true }
      ).lean();

      // Invalidate cache
      await this.invalidateUnreadCountCache(userId);

      logger.info("Notification marked as read", {
        notificationId,
        userId,
      });

      return notification;
    } catch (error) {
      logger.error("Failed to mark notification as read", {
        error: error.message,
        notificationId,
      });
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        {
          recipient: userId,
          isRead: false,
          isDeleted: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        }
      );

      // Invalidate cache
      await this.invalidateUnreadCountCache(userId);

      logger.info("All notifications marked as read", {
        userId,
        updatedCount: result.modifiedCount,
      });

      return result;
    } catch (error) {
      logger.error("Failed to mark all notifications as read", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete notification (soft delete)
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        {
          isDeleted: true,
        },
        { new: true }
      ).lean();

      await this.invalidateUnreadCountCache(userId);

      logger.info("Notification deleted", {
        notificationId,
        userId,
      });

      return notification;
    } catch (error) {
      logger.error("Failed to delete notification", {
        error: error.message,
        notificationId,
      });
      throw error;
    }
  }

  /**
   * Get unread notification count
   * Uses cache to avoid repeated DB queries
   */
  async getUnreadCount(userId) {
    try {
      // Try cache first
      const cachedCount = await redisService.get(
        `unreadCount:${userId}`
      );
      if (cachedCount !== null) {
        return cachedCount.count;
      }

      // Get from database
      const count = await Notification.countDocuments({
        recipient: userId,
        isRead: false,
        isDeleted: false,
      });

      // Cache for 5 minutes
      await redisService.set(`unreadCount:${userId}`, { count }, 5 * 60);

      return count;
    } catch (error) {
      logger.warn("Failed to get unread count", {
        error: error.message,
        userId,
      });
      return 0;
    }
  }

  /**
   * Invalidate unread count cache
   */
  async invalidateUnreadCountCache(userId) {
    try {
      await redisService.delete(`unreadCount:${userId}`);
    } catch (error) {
      logger.warn("Failed to invalidate unread count cache", {
        error: error.message,
        userId,
      });
    }
  }

  /**
   * Get notifications by type
   */
  async getNotificationsByType(userId, type, limit = 20) {
    try {
      const notifications = await Notification.find({
        recipient: userId,
        type,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return notifications;
    } catch (error) {
      logger.error("Failed to get notifications by type", {
        error: error.message,
        userId,
        type,
      });
      throw error;
    }
  }

  /**
   * Get notifications by priority
   */
  async getNotificationsByPriority(userId, priority, limit = 20) {
    try {
      const notifications = await Notification.find({
        recipient: userId,
        priority,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return notifications;
    } catch (error) {
      logger.error("Failed to get notifications by priority", {
        error: error.message,
        userId,
        priority,
      });
      throw error;
    }
  }

  /**
   * Clean up old notifications (called by cron job)
   * Deletes notifications older than 90 days
   */
  async cleanupOldNotifications() {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const result = await Notification.deleteMany({
        createdAt: { $lt: ninetyDaysAgo },
        isDeleted: true, // Only delete already soft-deleted ones
      });

      logger.info("Old notifications cleaned up", {
        deletedCount: result.deletedCount,
      });

      return result;
    } catch (error) {
      logger.error("Failed to cleanup old notifications", {
        error: error.message,
      });
      throw error;
    }
  }
}

export default new NotificationService();
