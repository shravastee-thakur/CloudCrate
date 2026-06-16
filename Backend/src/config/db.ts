import mongoose from "mongoose";
import { env } from "./env.js";
import logger from "../utils/logger.js";

export const connectDb = async () => {
  try {
    const mongoUrl = env.MONGO_URL;

    if (!mongoUrl) {
      throw new Error("MONGO_URL environment variable is not set");
    }

    await mongoose.connect(mongoUrl);
    console.log("Database conected");
  } catch (error) {
    logger.error(error);
    process.exit(-1);
  }
};
