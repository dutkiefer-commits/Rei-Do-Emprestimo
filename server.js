const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { db, hashPassword } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sistema-cobrancas-secreto';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'AutenticaÃ§Ã£o necessÃ¡ria.' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Token invÃ¡lido ou expirado.' });
    }
    req.user = payload;
    next();
  });
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e senha sÃ£o obrigatÃ³rios.' });
  }

  const passwordHash = hashPassword(password);
  db.get(
    'SELECT id, username FROM usuarios WHERE username = ? AND password_hash = ?',
    [username, passwordHash],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Erro interno no servidor.' });
      }
      if (!row) {
        return res.status(401).json({ error: 'Credenciais invÃ¡lidas.' });
      }

      const token = jwt.sign({ id: row.id, username: row.username }, JWT_SECRET, {
        expiresIn: '8h',
      });
      res.json({ token, username: row.username });
    }
  );
});

app.get('/api/profile', authenticateJWT, (req, res) => {
  res.json({ username: req.user.username });
});

app.post('/api/profile/change-password', authenticateJWT, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Senha atual e nova senha sÃ£o obrigatÃ³rias.' });
  }

  const currentHash = hashPassword(currentPassword);
  db.get(
    'SELECT id FROM usuarios WHERE id = ? AND password_hash = ?',
    [req.user.id, currentHash],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Erro interno no servidor.' });
      }
      if (!user) {
        return res.status(401).json({ error: 'Senha atual incorreta.' });
      }

      const newHash = hashPassword(newPassword);
      db.run(
        'UPDATE usuarios SET password_hash = ? WHERE id = ?',
        [newHash, req.user.id],
        function (updateErr) {
          if (updateErr) {
            return res.status(500).json({ error: 'Erro ao atualizar a senha.' });
          }
          res.json({ message: 'Senha atualizada com sucesso.' });
        }
      );
    }
  );
});

app.get('/api/clientes', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM clientes ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar clientes.' });
    }
    res.json(rows);
  });
});

app.post('/api/clientes', authenticateJWT, (req, res) => {
  const { nome, cpf_cnpj, telefone, whatsapp, endereco, email, chave_pix } = req.body;
  db.run(
    `INSERT INTO clientes (nome, cpf_cnpj, telefone, whatsapp, endereco, email, chave_pix)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nome || null, cpf_cnpj || null, telefone || null, whatsapp || null, endereco || null, email || null, chave_pix || null],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
      }
      res.json({ id: this.lastID });
    }
  );
});

app.get('/api/contratos', authenticateJWT, (req, res) => {
  const query = `
    SELECT c.id, c.cliente_id, c.valor, c.data_emprestimo, c.vencimento, c.pago,
           cl.nome AS cliente_nome, cl.telefone AS cliente_telefone, cl.whatsapp AS cliente_whatsapp
    FROM contratos c
    LEFT JOIN clientes cl ON cl.id = c.cliente_id
    ORDER BY c.created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar contratos.' });
    }
    res.json(rows);
  });
});

app.post('/api/contratos', authenticateJWT, (req, res) => {
  const { cliente_id, valor, data_emprestimo, vencimento } = req.body;
  db.run(
    `INSERT INTO contratos (cliente_id, valor, data_emprestimo, vencimento)
      VALUES (?, ?, ?, ?)`,
    [cliente_id || null, valor || null, data_emprestimo || null, vencimento || null],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao cadastrar contrato.' });
      }
      res.json({ id: this.lastID });
    }
  );
});

app.get('/api/dashboard', authenticateJWT, (req, res) => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowString = tomorrow.toISOString().split('T')[0];

  const totalQuery = `
    SELECT COALESCE(SUM(valor), 0) AS total_receber
    FROM contratos
    WHERE pago = 0
  `;
  const remindersQuery = `
    SELECT c.id, c.valor, c.data_emprestimo, c.vencimento, c.pago,
           cl.nome AS cliente_nome, cl.telefone AS cliente_telefone, cl.whatsapp AS cliente_whatsapp,
           JULIANDAY('now') - JULIANDAY(c.vencimento) AS dias_atraso
    FROM contratos c
    LEFT JOIN clientes cl ON cl.id = c.cliente_id
    WHERE c.pago = 0
    ORDER BY c.vencimento ASC
  `;
  const dueSoonQuery = `
    SELECT c.id, c.valor, c.data_emprestimo, c.vencimento,
           cl.nome AS cliente_nome, cl.telefone AS cliente_telefone, cl.whatsapp AS cliente_whatsapp
    FROM contratos c
    LEFT JOIN clientes cl ON cl.id = c.cliente_id
    WHERE c.pago = 0 AND (c.vencimento = ? OR c.vencimento = ?)
    ORDER BY c.vencimento ASC
  `;

  db.get(totalQuery, [], (err, totalRow) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao calcular total.' });
    }

    db.all(dueSoonQuery, [todayString, tomorrowString], (dueErr, dueRows) => {
      if (dueErr) {
        return res.status(500).json({ error: 'Erro ao buscar vencimentos prÃ³ximos.' });
      }

      db.all(remindersQuery, [], (remErr, reminderRows) => {
        if (remErr) {
          return res.status(500).json({ error: 'Erro ao buscar lembretes.' });
        }

        const overdue = reminderRows.map((row) => ({
          ...row,
          dias_atraso: Math.max(0, Math.floor(row.dias_atraso)),
        }));

        res.json({
          total_receber: totalRow.total_receber,
          vencendo: dueRows,
          lembretes: overdue,
        });
      });
    });
  });
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

