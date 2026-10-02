import { z } from "zod";

// Numeric primary key (id_<entity>). Coerced because ids also arrive as
// strings from URLs and <select> values.
export const idSchema = z.coerce.number().int().positive();

export const idWithMessage = (message: string) =>
  z.coerce.number(message).int(message).positive(message);
