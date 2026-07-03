import { getAuth } from "@clerk/express";

export async function getMe(req, res) {
  const auth = getAuth(req);
  const role = auth?.sessionClaims?.metadata?.role === "admin" ? "admin" : "user";
  res.json({ userId: auth.userId, role });
}
