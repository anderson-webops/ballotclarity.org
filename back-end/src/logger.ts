import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import process from "node:process";

type LogLevel = "debug" | "error" | "info" | "warn";

interface LogFields {
	[key: string]: unknown;
}

const levelWeight: Record<LogLevel, number> = {
	debug: 10,
	error: 40,
	info: 20,
	warn: 30
};

function resolveLogLevel() {
	const configured = (process.env.LOG_LEVEL || "info").trim().toLowerCase() as LogLevel;
	return configured in levelWeight ? configured : "info";
}

export function createLogger(service: string) {
	const minimumLevel = resolveLogLevel();

	function shouldLog(level: LogLevel) {
		return levelWeight[level] >= levelWeight[minimumLevel];
	}

	function log(level: LogLevel, message: string, fields: LogFields = {}) {
		if (!shouldLog(level))
			return;

		const payload = {
			...fields,
			level,
			message,
			service,
			timestamp: new Date().toISOString()
		};

		const line = JSON.stringify(payload);

		if (level === "error")
			console.error(line);
		else if (level === "warn")
			console.warn(line);
		else
			console.log(line);
	}

	return {
		debug: (message: string, fields?: LogFields) => log("debug", message, fields),
		error: (message: string, fields?: LogFields) => log("error", message, fields),
		info: (message: string, fields?: LogFields) => log("info", message, fields),
		warn: (message: string, fields?: LogFields) => log("warn", message, fields),
	};
}

export function createRequestLoggingMiddleware(logger: ReturnType<typeof createLogger>) {
	return function requestLoggingMiddleware(request: Request, response: Response, next: NextFunction) {
		const startedAt = Date.now();
		const requestId = request.header("x-request-id") || randomUUID();

		response.setHeader("x-request-id", requestId);
		response.locals.requestId = requestId;

		response.on("finish", () => {
			logger.info("request.completed", {
				durationMs: Date.now() - startedAt,
				ip: request.ip,
				method: request.method,
				path: request.originalUrl,
				requestId,
				statusCode: response.statusCode,
				userAgent: request.get("user-agent") || ""
			});
		});

		next();
	};
}
