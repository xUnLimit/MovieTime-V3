/** Single delivery policy shared by templates, notices and manual credential messages. */
export function deliveryPassword(password: string | null | undefined, accesoPorCodigo?: boolean): string {
  return accesoPorCodigo === true ? '' : password ?? '';
}
