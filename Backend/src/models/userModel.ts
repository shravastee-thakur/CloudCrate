import mongoose, { Schema, Model } from "mongoose";
import bcrypt from "bcrypt";

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  refreshToken: string;
  isVerified: boolean;
  storageUsed: number;
  storageLimit: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserMethods {
  comparePassword(plainPassword: string): Promise<boolean>;
}

type UserModel = Model<IUser, {}, IUserMethods>;

const userSchema = new Schema<IUser, UserModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    refreshToken: {
      type: String,
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    storageUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    storageLimit: {
      type: Number,
      default: 209715200, // 200MB in bytes.
      min: 0,
    },
  },

  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (plainPassword: string) {
  return bcrypt.compare(plainPassword, this.password);
};

const User = mongoose.model<IUser, UserModel>("User", userSchema);
export default User;
