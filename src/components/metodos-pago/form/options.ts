export const PAISES_MONEDAS = [
  { pais: "Panamá", moneda: "USD" },
  { pais: "Argentina", moneda: "ARS" },
  { pais: "Chile", moneda: "CLP" },
  { pais: "Colombia", moneda: "COP" },
  { pais: "Costa Rica", moneda: "CRC" },
  { pais: "Ecuador", moneda: "USD" },
  { pais: "Egipto", moneda: "EGP" },
  { pais: "España", moneda: "EUR" },
  { pais: "Estados Unidos", moneda: "USD" },
  { pais: "México", moneda: "MXN" },
  { pais: "Nigeria", moneda: "NGN" },
  { pais: "Perú", moneda: "PEN" },
  { pais: "Turquía", moneda: "TRY" },
  { pais: "Venezuela", moneda: "VES" },
];

export const MONEDAS = [
  "USD",
  "EUR",
  "COP",
  "MXN",
  "CRC",
  "VES",
  "ARS",
  "CLP",
  "PEN",
  "NGN",
  "TRY",
  "EGP",
];

export const TIPO_CUENTA_OPTIONS = [
  { value: "ahorro", label: "Ahorro" },
  { value: "corriente", label: "Corriente" },
  { value: "email", label: "Email" },
  { value: "telefono", label: "Teléfono" },
  { value: "wallet", label: "Wallet" },
] as const;

export const ASOCIADO_A_OPTIONS = [
  { value: "usuario", label: "Usuario" },
  { value: "servicio", label: "Servicio" },
] as const;

export function getAsociadoALabel(tipo: string | undefined) {
  switch (tipo) {
    case "usuario":
      return "Usuario";
    case "servicio":
      return "Servicio";
    default:
      return "Seleccionar";
  }
}

export function getTipoCuentaLabel(tipo: string | undefined) {
  switch (tipo) {
    case "ahorro":
      return "Ahorro";
    case "corriente":
      return "Corriente";
    case "wallet":
      return "Wallet";
    case "telefono":
      return "Teléfono";
    case "email":
      return "Email";
    default:
      return "Seleccionar tipo";
  }
}
