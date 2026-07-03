import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

/**
 * Call once near the app root (inside a component that has access to Clerk's
 * useAuth) to keep the axios instance's auth header in sync with the current
 * session token. See src/hooks/useApiAuth.js.
 */
export function setAuthTokenGetter(getTokenFn) {
  api.interceptors.request.clear?.();
  api.interceptors.request.use(async (config) => {
    const token = await getTokenFn?.();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}
