import { createLogger, format, transports, Logger, level } from "winston";
const { combine, timestamp, printf } = format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp}: ${level}: ${message}`;
});

const logger: Logger = createLogger({
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), myFormat),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "combined.log" }),
  ],
});

export default logger;
