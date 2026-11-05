export const notificationEventTypes = {
  taskAssigned: "task_assigned",
  taskDueSoon: "task_due_soon",
  taskOverdue: "task_overdue",
  taskComment: "task_comment",
  ownerDailyDigest: "owner_daily_digest",
} as const;

export type NotificationEventType =
  (typeof notificationEventTypes)[keyof typeof notificationEventTypes];

export const notificationChannels = {
  inApp: "in_app",
  whatsapp: "whatsapp",
  sms: "sms",
  email: "email",
} as const;

export type NotificationChannel =
  (typeof notificationChannels)[keyof typeof notificationChannels];

export const notificationDeliveryStatuses = {
  queued: "queued",
  sent: "sent",
  delivered: "delivered",
  failed: "failed",
} as const;

export type NotificationDeliveryStatus =
  (typeof notificationDeliveryStatuses)[keyof typeof notificationDeliveryStatuses];

export const notificationTemplates = {
  taskAssigned: "task_assigned",
  taskDueSoon: "task_due_soon",
  taskOverdue: "task_overdue",
  taskComment: "task_comment",
  ownerDailyDigest: "owner_daily_digest",
} as const satisfies Record<keyof typeof notificationEventTypes, string>;

export type NotificationTemplate =
  (typeof notificationTemplates)[keyof typeof notificationTemplates];

export type NotificationEvent = {
  eventId: string;
  companyId: string;
  recipientUserId: string;
  type: NotificationEventType;
  taskId?: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
};

export type NotificationDeliveryRecord = {
  eventId: string;
  companyId: string;
  recipientUserId: string;
  type: NotificationEventType;
  taskId?: string;
  channel: NotificationChannel;
  template: NotificationTemplate;
  status: NotificationDeliveryStatus;
  error?: string;
  sentAt?: Date;
};
