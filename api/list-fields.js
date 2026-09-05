export default async function handler(req, res) {
  try {
    const subdomain = process.env.KOMMO_SUBDOMAIN;
    const token = process.env.KOMMO_TOKEN;

    if (!subdomain || !token) {
      res.status(500).json({ error: 'Integração não configurada' });
      return;
    }

    const kommoRes = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/custom_fields`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!kommoRes.ok) {
      const errText = await kommoRes.text();
      res.status(502).json({ error: 'Falha ao consultar o Kommo', details: errText });
      return;
    }

    const data = await kommoRes.json();
    const fields = (data?._embedded?.custom_fields || []).map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
    }));

    res.status(200).json({ fields });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno', details: String(err) });
  }
}
