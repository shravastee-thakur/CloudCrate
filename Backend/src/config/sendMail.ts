import axios from "axios";
import { ApiError } from "../utils/apiError.js";

import { env } from "./env.js";

const apiKey = env.BREVO_API_KEY;
const senderEmail = env.SENDER_EMAIL;

if (!apiKey || !senderEmail) {
  throw new Error(
    "BREVO_API_KEY or SENDER_EMAIL environment variable is missing",
  );
}

const sendMail = async (to: string, subject: string, htmlContent: string) => {
  const data = {
    sender: { email: senderEmail },
    to: [{ email: to }],
    subject: subject,
    htmlContent: htmlContent,
  };

  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      data,
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      },
    );
    return response.data;
  } catch (error) {
    let errorMessage = "Unknown email sending error occurred";

    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    throw new ApiError(500, `Error sending email: ${errorMessage}`);
  }
};

export default sendMail;
