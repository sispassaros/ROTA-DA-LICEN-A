create or replace function notify_stage_change() returns trigger as $$
declare
  stage_names text[] := array[
    'Cadastro Técnico Federal',
    'Cadastro no SIGAM',
    'Envio da documentação',
    'Análise em andamento',
    'Licença liberada'
  ];
  prev_stage_title text;
  new_stage_title text;
  subject text;
  content_html text;
  site_url text := 'https://sispassaros.com.br';
  logo_url text := 'https://sispassaros.com.br/logo-icon.png';
  header_html text := '
    <tr>
      <td style="background:#0f172a;border-bottom:4px solid #4a6b5d;padding:32px 24px;text-align:center;">
        <img src="' || logo_url || '" width="52" height="52" alt="SisPássaros" style="display:block;margin:0 auto 12px;border-radius:10px;" />
        <div style="color:#ffffff;font-size:20px;font-weight:700;font-family:Arial,sans-serif;">Rota da Licença</div>
        <div style="color:#9db3a6;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;margin-top:4px;">SisPássaros — Consultoria e Certificado Digital</div>
      </td>
    </tr>';
  footer_html text := '
    <tr>
      <td style="padding:20px 32px;text-align:center;">
        <div style="font-size:11px;color:#94a3b8;font-family:Arial,sans-serif;">SisPássaros — Consultoria e Certificado Digital</div>
      </td>
    </tr>';
  button_html text := '<div style="text-align:center;margin-top:26px;"><a href="' || site_url || '" style="background:#0f172a;color:#ffffff;padding:13px 26px;border-radius:8px;text-decoration:none;display:inline-block;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">Acessar meu processo</a></div>';
begin
  if new.stage is distinct from old.stage or new.outcome is distinct from old.outcome then
    prev_stage_title := stage_names[old.stage + 1];
    new_stage_title := stage_names[new.stage + 1];
    subject := 'Atualização do seu processo — Rota da Licença';

    if new.stage = 4 and new.outcome = 'recusada' then
      content_html := '
        <tr>
          <td style="padding:32px;font-family:Arial,sans-serif;">
            <p style="color:#0f172a;font-size:16px;margin:0 0 12px;">Olá, ' || new.name || '!</p>
            <p style="color:#52606d;font-size:14px;line-height:1.6;margin:0 0 20px;">Houve uma atualização no seu processo de licenciamento.</p>
            <div style="background:#fdeeec;border:1px solid #f3b7ae;border-radius:10px;padding:18px 20px;">
              <div style="font-size:11px;color:#c23b2e;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:6px;">Resultado</div>
              <div style="font-size:16px;color:#c23b2e;font-weight:700;">Licença recusada pelo órgão ambiental</div>
            </div>
            <p style="color:#52606d;font-size:13.5px;line-height:1.6;margin:18px 0 0;">Entre em contato com seu consultor para entender os próximos passos.</p>
            ' || button_html || '
          </td>
        </tr>';
    else
      content_html := '
        <tr>
          <td style="padding:32px;font-family:Arial,sans-serif;">
            <p style="color:#0f172a;font-size:16px;margin:0 0 12px;">Olá, ' || new.name || '!</p>
            <p style="color:#52606d;font-size:14px;line-height:1.6;margin:0 0 20px;">Seu processo de licenciamento teve uma atualização:</p>
            <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;">
              <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:4px;">Etapa concluída</div>
              <div style="font-size:14.5px;color:#94a3b8;text-decoration:line-through;margin-bottom:14px;">' || prev_stage_title || '</div>
              <div style="font-size:11px;color:#4a6b5d;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:4px;">Etapa atual</div>
              <div style="font-size:17px;color:#0f172a;font-weight:700;">' || new_stage_title || '</div>
            </div>
            ' || button_html || '
          </td>
        </tr>';
    end if;

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer re_gwrEcgtr_JyQzWFMoAJKLWzu7PZiJgZaD',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'Rota da Licença <contato@sispassaros.com.br>',
        'to', new.email,
        'subject', subject,
        'html', '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;"><tr><td align="center"><table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">' || header_html || content_html || footer_html || '</table></td></tr></table>'
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;
