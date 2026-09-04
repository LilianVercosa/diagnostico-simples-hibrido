const PIPELINE_ID = 14272563; // Funil de isca — Diagnóstico Simples ou Híbrido

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { name, phone, score, verdict } = req.body || {};

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
    const leadName = hasResult
      ? `Diagnóstico Simples ou Híbrido — ${name} (${score}/10 — ${verdict})`
      : `Diagnóstico Simples ou Híbrido — ${name}`;

    const leadPayload = {
      name: leadName,
      pipeline_id: PIPELINE_ID,
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

    // Se tivermos o resultado do diagnóstico, adiciona uma nota detalhada no lead recém-criado
    if (hasResult) {
      try {
        const createdLead = kommoData?._embedded?.leads?.[0];
        const leadId = createdLead?.id;

        if (leadId) {
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
                  text: `Resultado do diagnóstico "Simples ou Híbrido": ${score} de 10 pontos — tendência: ${verdict}.`,
                },
              },
            ]),
          });
        }
      } catch (noteErr) {
        // não bloqueia a resposta principal se a nota falhar
        console.error('Falha ao adicionar nota no lead:', noteErr);
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
}
