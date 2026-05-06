import * as z from "zod";

export const metodoPagoSchemaComplete = z
  .object({
    nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    asociadoA: z.enum(["usuario", "servicio"] as const, {
      message: "Debe seleccionar asociado a",
    }),
    pais: z.string().min(2, "El país es requerido"),
    moneda: z.string().min(2, "La moneda es requerida"),
    alias: z.string().optional(),
    titular: z.string().min(2, "El titular es requerido"),
    notas: z.string().optional(),
    tipoCuenta: z
      .enum(["ahorro", "corriente", "wallet", "telefono", "email"] as const)
      .optional(),
    identificador: z.string().optional(),
    email: z.string().optional(),
    contrasena: z.string().optional(),
    numeroTarjeta: z.string().optional(),
    fechaExpiracion: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.asociadoA === "usuario") {
      if (!data.tipoCuenta) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe seleccionar un tipo de cuenta",
          path: ["tipoCuenta"],
        });
      }
      if (!data.identificador || data.identificador.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El identificador es requerido",
          path: ["identificador"],
        });
      }
    } else if (data.asociadoA === "servicio") {
      if (!data.numeroTarjeta || data.numeroTarjeta.length < 19) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Número de tarjeta inválido (mínimo 16 dígitos)",
          path: ["numeroTarjeta"],
        });
      } else if (data.numeroTarjeta.length > 24) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Número de tarjeta inválido (máximo 19 dígitos)",
          path: ["numeroTarjeta"],
        });
      }

      if (!data.fechaExpiracion || data.fechaExpiracion.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha de expiración es requerida",
          path: ["fechaExpiracion"],
        });
      } else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(data.fechaExpiracion)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Formato inválido (MM/YY)",
          path: ["fechaExpiracion"],
        });
      }
    }
  });

export type MetodoPagoFormData = z.infer<typeof metodoPagoSchemaComplete>;
