import * as z from "zod";

export const metodoPagoSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  tipo: z.enum(["banco", "yappy", "paypal", "binance", "efectivo"]),
  titular: z.string().min(2, "El titular es requerido"),
  identificador: z
    .string()
    .min(4, "El identificador debe tener al menos 4 caracteres"),
  tipoCuenta: z
    .enum(["ahorro", "corriente", "telefono", "wallet", "email"])
    .optional(),
  banco: z.string().optional(),
  pais: z.string(),
  moneda: z.string(),
});

export type MetodoPagoFormData = z.infer<typeof metodoPagoSchema>;
