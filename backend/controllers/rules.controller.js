import { z } from "zod";
import { getAuth } from "@clerk/express";
import RateLimitRule, { ALGORITHMS, IDENTIFIER_TYPES } from "../models/RateLimitRule.js";
import { invalidateRuleCache } from "../utils/ruleCache.js";

const ruleSchema = z.object({
  tenantId: z.string().min(1).max(100).trim().default("default"),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  endpointPattern: z.string().min(1).trim().default("*"),
  identifierType: z.enum(IDENTIFIER_TYPES).default("ip"),
  algorithm: z.enum(ALGORITHMS).default("fixed_window"),
  limit: z.number().int().positive(),
  windowSeconds: z.number().int().positive(),
  burst: z.number().int().positive().nullable().optional(),
  refillRate: z.number().positive().nullable().optional(),
  upstreamUrl: z.string().url().nullable().optional().or(z.literal("")),
  priority: z.number().int().optional(),
});

export async function listRules(req, res) {
  const rules = await RateLimitRule.find().sort({ priority: -1, createdAt: -1 });
  res.json({ rules });
}

export async function createRule(req, res) {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }
  const { userId } = getAuth(req);
  const rule = await RateLimitRule.create({ ...parsed.data, createdBy: userId });
  invalidateRuleCache();
  res.status(201).json({ rule });
}

export async function updateRule(req, res) {
  const parsed = ruleSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }
  const rule = await RateLimitRule.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  if (!rule) return res.status(404).json({ error: "not_found" });
  invalidateRuleCache();
  res.json({ rule });
}

export async function deleteRule(req, res) {
  const rule = await RateLimitRule.findByIdAndDelete(req.params.id);
  if (!rule) return res.status(404).json({ error: "not_found" });
  invalidateRuleCache();
  res.status(204).send();
}

export async function toggleRule(req, res) {
  const rule = await RateLimitRule.findById(req.params.id);
  if (!rule) return res.status(404).json({ error: "not_found" });
  rule.enabled = !rule.enabled;
  await rule.save();
  invalidateRuleCache();
  res.json({ rule });
}
