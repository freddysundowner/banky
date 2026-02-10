/**
 * Extract a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown, fallbackMessage = "Something went wrong. Please try again."): string {
  if (!error) {
    return fallbackMessage;
  }

  // If it's already a string, return it
  if (typeof error === "string") {
    return cleanErrorMessage(error);
  }

  // If it's an Error object
  if (error instanceof Error) {
    return cleanErrorMessage(error.message);
  }

  // If it's an object with common error properties
  if (typeof error === "object") {
    const errorObj = error as Record<string, unknown>;
    
    // FastAPI style: { detail: "message" }
    if (typeof errorObj.detail === "string") {
      return cleanErrorMessage(errorObj.detail);
    }
    
    // Common API style: { message: "..." }
    if (typeof errorObj.message === "string") {
      return cleanErrorMessage(errorObj.message);
    }
    
    // Alternative style: { error: "..." }
    if (typeof errorObj.error === "string") {
      return cleanErrorMessage(errorObj.error);
    }

    // Nested response: { response: { data: { message: "..." } } }
    if (errorObj.response && typeof errorObj.response === "object") {
      const response = errorObj.response as Record<string, unknown>;
      if (response.data && typeof response.data === "object") {
        const data = response.data as Record<string, unknown>;
        if (typeof data.message === "string") {
          return cleanErrorMessage(data.message);
        }
        if (typeof data.detail === "string") {
          return cleanErrorMessage(data.detail);
        }
      }
    }
  }

  return fallbackMessage;
}

/**
 * Clean up error messages by removing technical prefixes like status codes
 */
function cleanErrorMessage(message: string): string {
  if (!message) return "Something went wrong. Please try again.";
  
  // Remove status code prefix like "400: " or "500: "
  const withoutStatusCode = message.replace(/^\d{3}:\s*/, "");
  
  // Try to parse JSON in case the message contains a JSON string
  try {
    const parsed = JSON.parse(withoutStatusCode);
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
    if (typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Not JSON, continue with the message as-is
  }
  
  return withoutStatusCode || "Something went wrong. Please try again.";
}

/**
 * User-friendly status messages for HTTP status codes
 */
export const httpStatusMessages: Record<number, string> = {
  400: "Invalid request. Please check your input and try again.",
  401: "You are not authorized. Please log in again.",
  403: "You don't have permission to perform this action.",
  404: "The requested resource was not found.",
  409: "This action conflicts with existing data.",
  422: "Please check your input - some fields may be invalid.",
  500: "Something went wrong on our end. Please try again later.",
  502: "Server is temporarily unavailable. Please try again.",
  503: "Service is temporarily unavailable. Please try again later.",
  504: "Request timed out. Please try again.",
};

/**
 * Get a user-friendly message for an HTTP status code
 */
export function getHttpStatusMessage(status: number): string {
  return httpStatusMessages[status] || "An error occurred. Please try again.";
}
