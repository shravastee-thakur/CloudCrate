import { mailQueue, EmailJobData } from "../config/bullmq.js";
import { JobsOptions } from "bullmq";

export const sendEmailJob = async (
  data: EmailJobData,
  options?: JobsOptions,
) => {
  return mailQueue.add("sendEmail", data, {
    removeOnComplete: true,
    removeOnFail: true,
    ...options,
  });
};

export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  const htmlContent = `
    <h2>Welcome to CineFlow, ${userName}!</h2>
    <p>Your account has been created successfully.</p>
    <p>Start booking your favorite movies today.</p>
  `;

  return sendEmailJob({
    to: userEmail,
    subject: "Welcome to CineFlow!",
    htmlContent,
    textContent: `Welcome ${userName}! Your account is ready.`,
  });
};

export const sendLoginOtpEmail = async (userEmail: string, otp: string) => {
  const htmlContent = `
    <h2>Login Verification</h2>
    <p>Your OTP for login is:</p>
    <h2 style="font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${otp}</h2>
    <p>This OTP will expire in 5 minutes.</p>
    <p>If you did not request this login, please ignore this email.</p>
  `;

  return sendEmailJob({
    to: userEmail,
    subject: "Your 2FA Login OTP",
    htmlContent,
    textContent: `Your login OTP is ${otp}. Valid for 5 minutes.`,
  });
};

export const sendPasswordResetEmail = async (
  userEmail: string,
  resetLink: string,
) => {
  const htmlContent = `
    <h2>Password Reset Request</h2>
    <p>Click the link below to reset your password:</p>
    <a href="${resetLink}" style="padding:10px 15px;background:#4f46e5;color:#fff;border-radius:4px;text-decoration:none;">
      Reset Password
    </a>
    <p>This link will expire in 15 minutes.</p>
    <p>If you did not request this, please ignore this email.</p>
  `;

  return sendEmailJob({
    to: userEmail,
    subject: "Reset Your Password",
    htmlContent,
    textContent: `Click here to reset your password: ${resetLink}`,
  });
};
