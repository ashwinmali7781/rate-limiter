import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/me").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}
