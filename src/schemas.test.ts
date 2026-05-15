import { test, expect } from 'vitest';
import { AIParseResponseSchema } from './schemas';

test('AI parser validation', () => {
  const badData = { "intent": "general", "confidenceScore": "VERY HIGH" };
  const res = AIParseResponseSchema.safeParse(badData);
  expect(res.success).toBe(false);

  // default extracted_data check
  const okData = { intent: "personal_update", confidenceScore: 0.9, clarificationNeeded: false };
  const okRes = AIParseResponseSchema.safeParse(okData);
  expect(okRes.success).toBe(true);
});
