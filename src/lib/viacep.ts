/**
 * ViaCEP address lookup — used only by the public address form to prefill
 * city / state (and street / neighborhood) from a CEP. Best-effort: any
 * network / not-found error just returns null and the person fills the fields
 * manually. The only datum sent out is the CEP the person typed.
 */
export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export async function lookupCep(rawCep: string): Promise<CepAddress | null> {
  const cep = rawCep.replace(/\D/g, "");
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (data.erro || !data.localidade || !data.uf) return null;
    return {
      street: data.logradouro?.trim() ?? "",
      neighborhood: data.bairro?.trim() ?? "",
      city: data.localidade.trim(),
      state: data.uf.trim().toUpperCase(),
    };
  } catch {
    return null;
  }
}
