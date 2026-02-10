import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getErrorMessage, getHttpStatusMessage } from "./error-utils";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Try to parse as JSON and extract user-friendly message
    try {
      const json = JSON.parse(text);
      const message = getErrorMessage(json, getHttpStatusMessage(res.status));
      throw new Error(message);
    } catch (parseError) {
      // If we already created a user-friendly error, re-throw it
      if (parseError instanceof Error && parseError.message !== text) {
        throw parseError;
      }
    }
    
    // Fallback: provide user-friendly messages based on status code
    throw new Error(getHttpStatusMessage(res.status));
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnMount: "always",
      staleTime: 5000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 8000),
    },
    mutations: {
      retry: false,
    },
  },
});
