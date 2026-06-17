import User, { IUser, IUserMethods } from "../models/userModel.js";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

export type CreateUserData = Pick<
  IUser,
  "name" | "email" | "password" | "role"
>;

export const findByEmail = (email: string): Promise<UserDocument | null> => {
  return User.findOne({ email }).select("+password").exec();
};

export const findById = (userId: string): Promise<UserDocument | null> => {
  return User.findById(userId);
};

export const createUser = (userData: CreateUserData): Promise<UserDocument> => {
  return User.create(userData);
};

export const updateUser = (
  userId: string,
  update: Partial<IUser>,
): Promise<UserDocument | null> => {
  return User.findByIdAndUpdate(userId, update, { new: true });
};
