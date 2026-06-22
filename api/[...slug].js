const { Pool } = require('pg');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'sistema-cobrancas-secreto';

if (!DATABASE_URL) {
  console.error('DATABASE_URL nao definido. Verifique variaveis de ambiente.');
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

function hashPassword(password) {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
}

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nome TEXT,
        cpf_cnpj TEXT,
        telefone TEXT,
        whatsapp TEXT,
        endereco TEXT,
        email TEXT,
        chave_pix TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contratos (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER REFERENCES clientes(id),
        valor NUMERIC,
        data_emprestimo DATE,
        vencimento DATE,
        pago INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const adminUsername = 'admin';
    const adminPassword = 'admin123';
    const adminHash = hashPassword(adminPassword);
    const r = await client.query('SELECT id FROM usuarios WHERE username = $1', [adminUsername]);
    if (r.rowCount === 0) {
      await client.query('INSERT INTO usuarios (username, password_hash) VALUES ($1, $2)', [adminUsername, adminHash]);
      console.log('Usuario admin criado (admin / admin123)');
    }
  } finally {
    client.release();
  }
}

// initialize once
initDb().catch((err) => console.error('Erro initDb:', err));

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function parseAuth(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.end();
    return;
  }

  const url = req.url || '';
  const parts = url.split('/').filter(Boolean); // after /api
  const route = parts[0] || '';

  try {
    if (route === 'login' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { username, password } = JSON.parse(body || '{}');
      if (!username || !password) return sendJson(res, 400, { error: 'Username e senha obrigatorios.' });
      const hash = hashPassword(password);
      const client = await pool.connect();
      try {
        const r = await client.query('SELECT id, username FROM usuarios WHERE username=$1 AND password_hash=$2', [username, hash]);
        if (r.rowCount === 0) return sendJson(res, 401, { error: 'Credenciais invalidas.' });
        const row = r.rows[0];
        const token = jwt.sign({ id: row.id, username: row.username }, JWT_SECRET, { expiresIn: '8h' });
        return sendJson(res, 200, { token, username: row.username });
      } finally { client.release(); }
    }

    if (route === 'profile' && req.method === 'GET') {
      const payload = parseAuth(req);
      if (!payload) return sendJson(res, 401, { error: 'Autenticacao necessária.' });
      return sendJson(res, 200, { username: payload.username });
    }

    if (route === 'profile' && parts[1] === 'change-password' && req.method === 'POST') {
      const payload = parseAuth(req);
      if (!payload) return sendJson(res, 401, { error: 'Autenticacao necessária.' });
      let body = '';
      for await (const chunk of req) body += chunk;
      const { currentPassword, newPassword } = JSON.parse(body || '{}');
      if (!currentPassword || !newPassword) return sendJson(res, 400, { error: 'Senhas obrigatorias.' });
      const client = await pool.connect();
      try {
        const currentHash = hashPassword(currentPassword);
        const r = await client.query('SELECT id FROM usuarios WHERE id=$1 AND password_hash=$2', [payload.id, currentHash]);
        if (r.rowCount === 0) return sendJson(res, 401, { error: 'Senha atual incorreta.' });
        const newHash = hashPassword(newPassword);
        await client.query('UPDATE usuarios SET password_hash=$1 WHERE id=$2', [newHash, payload.id]);
        return sendJson(res, 200, { message: 'Senha atualizada com sucesso.' });
      } finally { client.release(); }
    }

    if (route === 'clientes') {
      if (req.method === 'GET') {
        const payload = parseAuth(req);
        if (!payload) return sendJson(res, 401, { error: 'Autenticacao necessária.' });
        const client = await pool.connect();
        try {
          const r = await client.query('SELECT * FROM clientes ORDER BY created_at DESC');
          return sendJson(res, 200, r.rows);
        } finally { client.release(); }
      }

      if (req.method === 'POST') {
        const payload = parseAuth(req);
        if (!payload) return sendJson(res, 401, { error: 'Autenticacao necessária.' });
        let body = '';
        for await (const chunk of req) body += chunk;
        const data = JSON.parse(body || '{}');
        const client = await pool.connect();
        try {
          const r = await client.query(
            `INSERT INTO clientes (nome, cpf_cnpj, telefone, whatsapp, endereco, email, chave_pix)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [data.nome || null, data.cpf_cnpj || null, data.telefone || null, data.whatsapp || null, data.endereco || null, data.email || null, data.chave_pix || null]
          );
          return sendJson(res, 200, { id: r.rows[0].id });
        } finally { client.release(); }
      }
    }

    if (route === 'contratos') {
      if (req.method === 'GET') {
        const payload = parseAuth(req);
        if (!payload) return sendJson(res, 401, { error: 'Autenticacao necessária.' });
        const client = await pool.connect();
        try {
          const r = await client.query(
            `SELECT c.*, cl.nome as cliente_nome, cl.telefone as cliente_telefone, cl.whatsapp as cliente_whatsapp
             FROM contratos c LEFT JOIN clientes cl ON cl.id = c.cliente_id ORDER BY c.created_at DESC`
          );
          return sendJson(res, 200, r.rows);
        } finally { client.release(); }
      }

      if (req.method === 'POST') {
        const payload = parseAuth(req);
        if (!payload) return sendJson(res, 401, { error: 'Autenticacao necessária.' });
        let body = '';
        for await (const chunk of req) body += chunk;
        const data = JSON.parse(body || '{}');
        const client = await pool.connect();
        try {
          const r = await client.query(
            `INSERT INTO contratos (cliente_id, valor, data_emprestimo, vencimento)
             VALUES ($1,$2,$3,$4) RETURNING id`,
            [data.cliente_id || null, data.valor || null, data.data_emprestimo || null, data.vencimento || null]
          );
          return sendJson(res, 200, { id: r.rows[0].id });
        } finally { client.release(); }
      }
    }

    if (route === 'dashboard' && req.method === 'GET') {
      const payload = parseAuth(req);
      if (!payload) return sendJson(res, 401, { error: 'Autenticacao necessária.' });
      const client = await pool.connect();
      try {
        const totalRes = await client.query('SELECT COALESCE(SUM(valor),0) AS total_receber FROM contratos WHERE pago = 0');
        const dueRes = await client.query(`SELECT c.id, c.valor, c.data_emprestimo, c.vencimento, cl.nome as cliente_nome, cl.telefone as cliente_telefone, cl.whatsapp as cliente_whatsapp FROM contratos c LEFT JOIN clientes cl ON cl.id = c.cliente_id WHERE c.pago = 0 ORDER BY c.vencimento ASC LIMIT 10`);
        const remRes = await client.query(`SELECT c.id, c.valor, c.data_emprestimo, c.vencimento, c.pago, cl.nome as cliente_nome, cl.telefone as cliente_telefone, cl.whatsapp as cliente_whatsapp, EXTRACT(DAY FROM (CURRENT_DATE - c.vencimento)) AS dias_atraso FROM contratos c LEFT JOIN clientes cl ON cl.id = c.cliente_id WHERE c.pago = 0 ORDER BY c.vencimento ASC`);
        const overdue = remRes.rows.map(r => ({ ...r, dias_atraso: Math.max(0, Math.floor(r.dias_atraso)) }));
        return sendJson(res, 200, { total_receber: Number(totalRes.rows[0].total_receber), vencendo: dueRes.rows, lembretes: overdue });
      } finally { client.release(); }
    }

    return sendJson(res, 404, { error: 'Rota nao encontrada' });
  } catch (err) {
    console.error('API error:', err);
    return sendJson(res, 500, { error: 'Erro interno no servidor.' });
  }
};
