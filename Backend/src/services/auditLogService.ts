import * as auditLogRepo from "../repositories/auditLogRepo.js";
import {
  AuditLogDocument,
  CreateAuditLogData,
} from "../repositories/auditLogRepo.js";
import { IAuditLog } from "../models/auditLog.js";
import { ApiError } from "../utils/apiError.js";

export interface AuditLogDto {
  _id: string;
  actorId?: string;
  actorType: IAuditLog["actorType"];
  action: IAuditLog["action"];
  targetResourceId: string;
  targetResourceType: IAuditLog["targetResourceType"];
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const mapToAuditLogDto = (log: AuditLogDocument): AuditLogDto => {
  const obj = log.toObject();
  return {
    _id: obj._id.toString(),
    actorId: obj.actorId?.toString(),
    actorType: obj.actorType,
    action: obj.action,
    targetResourceId: obj.targetResourceId,
    targetResourceType: obj.targetResourceType,
    metadata: obj.metadata,
    ipAddress: obj.ipAddress,
    userAgent: obj.userAgent,
    createdAt: obj.createdAt!,
  };
};

export const logAction = async (data: CreateAuditLogData): Promise<void> => {
  await auditLogRepo.createAuditLog(data);
};

export const getTargetHistory = async (
  targetResourceId: string,
  page: number,
  limit: number,
) => {
  const result = await auditLogRepo.getLogsByTarget(
    targetResourceId,
    page,
    limit,
  );
  return {
    logs: result.logs.map(mapToAuditLogDto),
    totalCount: result.totalCount,
    page,
    limit,
  };
};

export const getActorHistory = async (
  actorId: string,
  page: number,
  limit: number,
) => {
  const result = await auditLogRepo.getLogsByActor(actorId, page, limit);
  return {
    logs: result.logs.map(mapToAuditLogDto),
    totalCount: result.totalCount,
    page,
    limit,
  };
};

export const getGlobalFeed = async (page: number, limit: number) => {
  const result = await auditLogRepo.getGlobalFeed(page, limit);
  return {
    logs: result.logs.map(mapToAuditLogDto),
    totalCount: result.totalCount,
    page,
    limit,
  };
};
