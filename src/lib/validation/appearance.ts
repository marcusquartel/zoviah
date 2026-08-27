import { z } from "zod";

/** `#rgb` or `#rrggbb`, or empty to clear the value. */
export const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    error: "Use um hexadecimal como #4F46E5.",
  });

export const appearanceSchema = z.object({
  primaryColor: z.union([hexColor, z.literal("")]),
  secondaryColor: z.union([hexColor, z.literal("")]),
});

export type AppearanceInput = z.infer<typeof appearanceSchema>;
