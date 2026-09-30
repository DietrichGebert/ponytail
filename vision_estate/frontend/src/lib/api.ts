import type { components } from "./generated/api-types";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let refreshInFlight: Promise<boolean> | null = null;
async function refreshSession() {
  if (!refreshInFlight) {
    const renew = async () => {
      // Another tab may have renewed while this tab waited for the browser lock.
      const current = await fetch("/api/auth/me", { cache: "no-store" });
      if (current.ok) return true;
      return (
        await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" })
      ).ok;
    };
    refreshInFlight = Promise.resolve(
      typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks.request("ve-auth-refresh", renew)
        : renew(),
    )
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const send = () =>
    fetch("/api/" + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      cache: "no-store",
    });
  let response = await send();
  if (
    response.status === 401 &&
    (!path.startsWith("auth/") || path === "auth/me") &&
    (await refreshSession())
  )
    response = await send();
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      Array.isArray(body.detail)
        ? body.detail.join(". ")
        : body.detail ||
            body.message ||
            "The service is unavailable. Please try again.",
      response.status,
    );
  return body as T;
}
export function assessmentHeaders(id: string) {
  return {
    "x-assessment-token": sessionStorage.getItem("ve-assessment-" + id) || "",
  };
}
export function errorMessage(e: unknown) {
  return e instanceof Error
    ? e.message
    : "Something went wrong. Please try again.";
}
export type Report = components["schemas"]["ReportContent"];
export type Lead = components["schemas"]["LeadDetail"];
export type Identity = components["schemas"]["Identity"];
export type LeadPage = components["schemas"]["LeadPage"];
export type AssessmentCreated = components["schemas"]["AssessmentCreated"];
export type CreateProperty = components["schemas"]["CreateProperty"];
export const money = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
