// Friendly PT-BR text for `submit_application` RPC error codes, shared by the
// public form, manual creator entry, and spreadsheet import. Returns null for
// an unrecognized message so each caller can log + pick its own fallback text.
export function mapSubmitApplicationError(
  message: string | undefined,
): string | null {
  const msg = message ?? "";

  if (msg.includes("PROGRAM_NOT_ACCEPTING")) {
    return "As inscrições deste programa não estão abertas no momento.";
  }
  if (msg.includes("PROGRAM_NOT_FOUND")) {
    return "Formulário indisponível.";
  }
  if (msg.includes("MISSING_NAME")) {
    return "Informe seu nome completo.";
  }
  if (
    msg.includes("PAYLOAD_TOO_LARGE") ||
    msg.includes("TOO_MANY_FIELDS") ||
    msg.includes("ANSWER_TOO_LONG") ||
    msg.includes("INVALID_PAYLOAD")
  ) {
    return "Revise os campos: algum conteúdo é grande ou inválido demais.";
  }
  if (
    msg.includes("PROGRAM_RATE_LIMITED") ||
    msg.includes("IDENTITY_RATE_LIMITED")
  ) {
    return "Muitas tentativas. Tente novamente em alguns minutos.";
  }
  return null;
}
