import AuditLog, { IAuditLog } from "../models/auditLog.js";
import { HydratedDocument } from "mongoose";
import mongoose from "mongoose";

export type AuditLogDocument = HydratedDocument<IAuditLog>;

export interface CreateAuditLogData {
  actorId?: string;
  actorType: IAuditLog["actorType"];
  action: IAuditLog["action"];
  targetResourceId: string;
  targetResourceType: IAuditLog["targetResourceType"];
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export const createAuditLog = async (
  data: CreateAuditLogData,
): Promise<AuditLogDocument> => {
  return AuditLog.create({
    actorId: data.actorId
      ? new mongoose.Types.ObjectId(data.actorId)
      : undefined,
    actorType: data.actorType,
    action: data.action,
    targetResourceId: data.targetResourceId,
    targetResourceType: data.targetResourceType,
    metadata: data.metadata || {},
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });
};

export const getLogsByTarget = async (
  targetResourceId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ logs: AuditLogDocument[]; totalCount: number }> => {
  const query = { targetResourceId };
  const skip = (page - 1) * limit;

  const [logs, totalCount] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
    AuditLog.countDocuments(query).exec(),
  ]);

  return { logs, totalCount };
};

export const getLogsByActor = async (
  actorId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ logs: AuditLogDocument[]; totalCount: number }> => {
  const query = { actorId: new mongoose.Types.ObjectId(actorId) };
  const skip = (page - 1) * limit;

  const [logs, totalCount] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
    AuditLog.countDocuments(query).exec(),
  ]);

  return { logs, totalCount };
};

export const getGlobalFeed = async (
  page: number = 1,
  limit: number = 20,
): Promise<{ logs: AuditLogDocument[]; totalCount: number }> => {
  const skip = (page - 1) * limit;

  const [logs, totalCount] = await Promise.all([
    AuditLog.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
    AuditLog.countDocuments({}).exec(),
  ]);

  return { logs, totalCount };
};
