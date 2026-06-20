import mongoose, { Schema, Model } from "mongoose";

export interface IAuditLog {
  actorId?: mongoose.Types.ObjectId;
  actorType: "USER" | "ADMIN" | "SYSTEM";
  action:
    | "DELETE_MEDIA"
    | "BAN_USER"
    | "UPDATE_ROLE"
    | "PURGE_ORPHANED_FILES"
    | "REVOKE_SHARE_LINK";
  targetResourceId: string;
  targetResourceType: "USER" | "MEDIA" | "SHARE_LINK" | "SYSTEM";
  metadata: Record<string, any>; // Store previous values, IP address, etc.
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    actorType: {
      type: String,
      enum: ["USER", "ADMIN", "SYSTEM"],
      required: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetResourceId: {
      type: String,
      required: true,
    },
    targetResourceType: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

auditLogSchema.index({ targetResourceId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>(
  "AuditLog",
  auditLogSchema,
);
export default AuditLog;
