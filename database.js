const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err.message);
    process.exit(1);
  }
});

function hashPassword(password) {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
}

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        cpf_cnpj TEXT,
        telefone TEXT,
        whatsapp TEXT,
        endereco TEXT,
        email TEXT,
        chave_pix TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS contratos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        valor REAL,
        data_emprestimo TEXT,
        vencimento TEXT,
        pago INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
      )
    `);

    const adminUsername = 'admin';
    const adminPassword = 'admin123';
    const adminHash = hashPassword(adminPassword);

    db.get('SELECT id FROM usuarios WHERE username = ?', [adminUsername], (err, row) => {
      if (err) {
        console.error('Erro ao verificar usuário admin:', err.message);
        return;
      }

      if (!row) {
        db.run(
          'INSERT INTO usuarios (username, password_hash) VALUES (?, ?)',
          [adminUsername, adminHash],
          (insertErr) => {
            if (insertErr) {
              console.error('Erro ao criar usuário admin:', insertErr.message);
            } else {
              console.log('Usuário admin criado com sucesso. Login padrão: admin / admin123');
            }
          }
        );
      }
    });
  });
}

initDatabase();

module.exports = {
  db,
  hashPassword,
};
