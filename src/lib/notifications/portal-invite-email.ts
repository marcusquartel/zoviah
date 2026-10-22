/** The "acesse seu portal" invite e-mail. Pure (no I/O). */
export function buildPortalInviteEmail(input: {
  creatorName: string;
  organizationName: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const e = (v: string) =>
    v
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const { creatorName, organizationName, url } = input;
  const subject = `Seu portal de creator ${organizationName} está pronto`;
  const text = [
    `Oi, ${creatorName}!`,
    "",
    `A ${organizationName} criou seu acesso ao portal de creators. Lá você acompanha suas vendas, comissões, cupons e sua posição no ranking do mês.`,
    "",
    `Crie sua senha neste link (válido por 14 dias):`,
    url,
    "",
    `Equipe ${organizationName}`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f6f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f1f1f">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<div style="background:#ffffff;border-radius:16px;padding:28px">
<p style="margin:0 0 4px;font-size:13px;color:#6b6b6b">${e(organizationName)}</p>
<h1 style="margin:0 0 16px;font-size:20px">Oi, ${e(creatorName)}! Seu portal está pronto ✨</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">Acompanhe suas vendas, comissões, cupons e sua posição no ranking do mês.</p>
<p style="margin:0 0 20px"><a href="${e(url)}" style="display:inline-block;background:#1f1f1f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px">Criar minha senha</a></p>
<p style="margin:0;font-size:13px;color:#6b6b6b">O link vale por 14 dias. Se o botão não funcionar, copie e cole:<br><span style="word-break:break-all">${e(url)}</span></p>
</div>
<p style="margin:16px 0 0;text-align:center;font-size:12px;color:#9a9a9a">Enviado pelo Zoviah em nome da ${e(organizationName)}.</p>
</div></body></html>`;
  return { subject, html, text };
}
