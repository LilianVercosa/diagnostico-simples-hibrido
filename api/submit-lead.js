const PIPELINE_ID = 14272563; // Funil de isca — Diagnóstico Simples ou Híbrido

const FIELD_PERFIL = 4352370;
const FIELD_PONTUACAO = 4352372;
const FIELD_RESULTADO = 4352374;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { name, phone, segment, score, verdict } = req.body || {};

    if (!name || !phone) {
      res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
      return;
    }

    const subdomain = process.env.KOMMO_SUBDOMAIN;
    const token = process.env.KOMMO_TOKEN;

    if (!subdomain || !token) {
      console.error('KOMMO_SUBDOMAIN ou KOMMO_TOKEN não configurados no Vercel');
      res.status(500).json({ error: 'Integração não configurada' });
      return;
    }

    const hasResult = typeof score !== 'undefined' && verdict;

    // Nome do lead fica limpo — perfil e resultado ficam nos campos personalizados
    const leadName = `Diagnóstico Simples ou Híbrido — ${name}`;

    const customFields = [];
    if (segment) {
      customFields.push({
        field_id: FIELD_PERFIL,
        values: [{ value: segment }],
      });
    }
    if (hasResult) {
      customFields.push({
        field_id: FIELD_PONTUACAO,
        values: [{ value: `${score}/10` }],
      });
      customFields.push({
        field_id: FIELD_RESULTADO,
        values: [{ value: verdict }],
      });
    }

    const leadPayload = {
      name: leadName,
      pipeline_id: PIPELINE_ID,
      ...(customFields.length > 0 ? { custom_fields_values: customFields } : {}),
      _embedded: {
        contacts: [
          {
            name: name,
            custom_fields_values: [
              {
                field_code: 'PHONE',
                values: [{ value: phone, enum_code: 'WORK' }],
              },
            ],
          },
        ],
      },
    };

    const kommoRes = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/complex`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([leadPayload]),
    });

    if (!kommoRes.ok) {
      const errText = await kommoRes.text();
      console.error('Erro do Kommo:', errText);
      res.status(502).json({ error: 'Falha ao enviar para o Kommo' });
      return;
    }

    const kommoData = await kommoRes.json();

    // Além dos campos, mantém uma nota com o resumo completo por segurança
    try {
      const createdLead = kommoData?._embedded?.leads?.[0];
      const leadId = createdLead?.id;

      if (leadId) {
        const noteLines = [];
        if (segment) noteLines.push(`Perfil: ${segment}`);
        if (hasResult) noteLines.push(`Resultado do diagnóstico "Simples ou Híbrido": ${score} de 10 pontos.`);
        if (hasResult) noteLines.push(`Tendência: ${verdict}.`);

        if (noteLines.length > 0) {
          await fetch(`https://${subdomain}.kommo.com/api/v4/leads/${leadId}/notes`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([
              {
                note_type: 'common',
                params: {
                  text: noteLines.join('\n'),
                },
              },
            ]),
          });
        }
      }
    } catch (noteErr) {
      console.error('Falha ao adicionar nota no lead:', noteErr);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
}
