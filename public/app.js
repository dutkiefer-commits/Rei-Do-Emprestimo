const apiBase = '/api';
const appShell = document.getElementById('appShell');
const loginSection = document.getElementById('loginSection');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const pageTitle = document.getElementById('pageTitle');
const profileUsername = document.getElementById('profileUsername');
const logoutButton = document.getElementById('logoutButton');
const navItems = Array.from(document.querySelectorAll('.nav-item'));

const sections = {
  dashboard: document.getElementById('dashboard'),
  clientes: document.getElementById('clientes'),
  contratos: document.getElementById('contratos'),
  perfil: document.getElementById('perfil'),
  ajuda: document.getElementById('ajuda'),
};

const totalReceber = document.getElementById('totalReceber');
const vencendoCount = document.getElementById('vencendoCount');
const atrasoCount = document.getElementById('atrasoCount');
const reminderTableBody = document.getElementById('reminderTableBody');

const clienteForm = document.getElementById('clienteForm');
const clienteMessage = document.getElementById('clienteMessage');
const clientesTableBody = document.getElementById('clientesTableBody');
const contratoForm = document.getElementById('contratoForm');
const contratoMessage = document.getElementById('contratoMessage');
const contratosTableBody = document.getElementById('contratosTableBody');
const contratoClienteSelect = document.getElementById('contratoCliente');
const senhaForm = document.getElementById('senhaForm');
const senhaMessage = document.getElementById('senhaMessage');

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

function fetchJson(endpoint, options = {}) {
  const headers = options.headers || {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${apiBase}${endpoint}`, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...options,
  }).then(async (res) => {
    const contentType = res.headers.get('content-type');
    const body = contentType && contentType.includes('application/json') ? await res.json() : null;
    if (!res.ok) {
      throw new Error((body && body.error) || 'Erro na requisiÃ§Ã£o');
    }
    return body;
  });
}

// Se estiver hospedado no GitHub Pages, usar uma API mock local (demo)
const isHosted = location.hostname.endsWith('github.io') || location.hostname.includes('githubusercontent.com');
if (isHosted) {
  console.log('Executando em modo demo (hosted) — usando API mock local');
  const demo = {
    users: [{ id: 1, username: 'admin', password: 'admin123' }],
    clientes: [
      { id: 1, nome: 'Cliente Exemplo', cpf_cnpj: '000.000.000-00', telefone: '11999990000', whatsapp: '11999990000', email: 'contato@exemplo.com' },
    ],
    contratos: [
      { id: 1, cliente_id: 1, valor: 1500, data_emprestimo: '2026-06-01', vencimento: '2026-07-01', pago: 0 },
    ],
  };

  let demoToken = null;

  fetchJson = async (endpoint, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;

    // /login
    if (endpoint === '/login' && method === 'POST') {
      const { username, password } = body || {};
      const user = demo.users.find((u) => u.username === username && u.password === password);
      if (!user) {
        const e = new Error('Credenciais invalidas.');
        e.status = 401;
        throw e;
      }
      demoToken = 'demo-token-' + Date.now();
      return { token: demoToken, username: user.username };
    }

    // autenticar chamadas que exigem token
    if (['/profile', '/profile/change-password', '/clientes', '/contratos', '/dashboard'].includes(endpoint)) {
      const headers = options.headers || {};
      const auth = headers.Authorization || (options.headers && options.headers.Authorization);
      if (!auth || !auth.startsWith('Bearer ') || auth.split(' ')[1] !== demoToken) {
        const e = new Error('Autenticacao necessária.');
        e.status = 401;
        throw e;
      }
    }

    if (endpoint === '/profile' && method === 'GET') {
      return { username: 'admin' };
    }

    if (endpoint === '/dashboard' && method === 'GET') {
      return {
        total_receber: demo.contratos.reduce((s, c) => s + (c.pago ? 0 : c.valor), 0),
        vencendo: demo.contratos.slice(0, 1),
        lembretes: demo.contratos.map((c) => ({ ...c, cliente_nome: demo.clientes.find((x) => x.id === c.cliente_id)?.nome || 'Cliente' , dias_atraso: 0 })),
      };
    }

    if (endpoint === '/clientes' && method === 'GET') {
      return demo.clientes;
    }

    if (endpoint === '/clientes' && method === 'POST') {
      const novo = { id: demo.clientes.length + 1, ...body };
      demo.clientes.unshift(novo);
      return { id: novo.id };
    }

    if (endpoint === '/contratos' && method === 'GET') {
      return demo.contratos.map((c) => ({ ...c, cliente_nome: demo.clientes.find((x) => x.id === c.cliente_id)?.nome || 'Cliente' }));
    }

    if (endpoint === '/contratos' && method === 'POST') {
      const novo = { id: demo.contratos.length + 1, ...body };
      demo.contratos.unshift(novo);
      return { id: novo.id };
    }

    if (endpoint === '/profile/change-password' && method === 'POST') {
      return { message: 'Senha atualizada com sucesso.' };
    }

    // fallback — tentar usar fetch real se disponível
    return (await window.fetch(`${apiBase}${endpoint}`, { ...options })).json();
  };
}

function showSection(key) {
  Object.values(sections).forEach((section) => section.classList.add('hidden'));
  const target = sections[key];
  if (target) {
    target.classList.remove('hidden');
    pageTitle.textContent = target.querySelector('h3')?.textContent || 'Dashboard';
  }
  navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.section === key);
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR');
}

function getLastDaysText(days) {
  if (days <= 0) return 'Vence hoje/amanhÃ£';
  return `${days} dia(s)`;
}

function getStatusBadge(pago) {
  const status = pago ? 'Pago' : 'Pendente';
  const cls = pago ? 'status-pago' : 'status-pendente';
  return `<span class="status-badge ${cls}">${status}</span>`;
}

function createWhatsappLink(phone) {
  if (!phone) return '#';
  const cleaned = phone.replace(/\D+/g, '');
  return `https://wa.me/${cleaned}`;
}

function showApp() {
  loginSection.classList.add('hidden');
  appShell.classList.remove('hidden');
  showSection('dashboard');
}

function hideApp() {
  loginSection.classList.remove('hidden');
  appShell.classList.add('hidden');
}

function displayMessage(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? '#b91c1c' : '#0f766e';
  setTimeout(() => {
    element.textContent = '';
  }, 5000);
}

function loadProfile() {
  return fetchJson('/profile').then((data) => {
    profileUsername.textContent = data.username || 'Administrador';
  });
}

function loadDashboard() {
  return fetchJson('/dashboard').then((data) => {
    totalReceber.textContent = formatCurrency(data.total_receber);
    vencendoCount.textContent = `${data.vencendo.length} contrato(s)`;
    atrasoCount.textContent = `${data.lembretes.filter((item) => item.pago === 0).length} pendÃªncia(s)`;
    reminderTableBody.innerHTML = data.lembretes
      .map((item) => `
        <tr>
          <td>${item.cliente_nome || 'Cliente nÃ£o informado'}</td>
          <td>${item.cliente_telefone || '-'}</td>
          <td>${formatDate(item.vencimento)}</td>
          <td>${formatCurrency(item.valor)}</td>
          <td>${Math.max(0, Math.floor(item.dias_atraso))}</td>
          <td><a class="whatsapp-button" href="${createWhatsappLink(item.cliente_whatsapp || item.cliente_telefone)}" target="_blank">WhatsApp</a></td>
        </tr>
      `)
      .join('');
  });
}

function loadClients() {
  return fetchJson('/clientes').then((clients) => {
    clientesTableBody.innerHTML = clients
      .map((client) => `
        <tr>
          <td>${client.nome || '-'}</td>
          <td>${client.cpf_cnpj || '-'}</td>
          <td>${client.telefone || '-'}</td>
          <td>${client.whatsapp || '-'}</td>
          <td>${client.email || '-'}</td>
        </tr>
      `)
      .join('');

    contratoClienteSelect.innerHTML = `
      <option value="">Selecione o cliente</option>
      ${clients
        .map((client) => `<option value="${client.id}">${client.nome || 'Cliente sem nome'}</option>`)
        .join('')}
    `;
  });
}

function loadContracts() {
  return fetchJson('/contratos').then((contracts) => {
    contratosTableBody.innerHTML = contracts
      .map((contrato) => `
        <tr>
          <td>${contrato.cliente_nome || 'Sem cliente'}</td>
          <td>${formatCurrency(contrato.valor)}</td>
          <td>${formatDate(contrato.data_emprestimo)}</td>
          <td>${formatDate(contrato.vencimento)}</td>
          <td>${getStatusBadge(contrato.pago)}</td>
        </tr>
      `)
      .join('');
  });
}

function refreshAll() {
  return Promise.all([loadDashboard(), loadClients(), loadContracts()]).catch((error) => {
    console.error(error);
  });
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    displayMessage(loginMessage, 'Preencha usuÃ¡rio e senha.', true);
    return;
  }

  fetchJson('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
    .then((data) => {
      setToken(data.token);
      showApp();
      loadProfile();
      refreshAll();
    })
    .catch((error) => {
      displayMessage(loginMessage, error.message, true);
    });
});

logoutButton.addEventListener('click', () => {
  setToken(null);
  hideApp();
});

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    showSection(item.dataset.section);
  });
});

clienteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const payload = {
    nome: document.getElementById('clienteNome').value.trim() || null,
    cpf_cnpj: document.getElementById('clienteCpfCnpj').value.trim() || null,
    telefone: document.getElementById('clienteTelefone').value.trim() || null,
    whatsapp: document.getElementById('clienteWhatsapp').value.trim() || null,
    endereco: document.getElementById('clienteEndereco').value.trim() || null,
    email: document.getElementById('clienteEmail').value.trim() || null,
    chave_pix: document.getElementById('clientePix').value.trim() || null,
  };

  fetchJson('/clientes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
    .then(() => {
      displayMessage(clienteMessage, 'Cliente cadastrado com sucesso.');
      clienteForm.reset();
      loadClients();
      loadDashboard();
    })
    .catch((error) => displayMessage(clienteMessage, error.message, true));
});

contratoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const payload = {
    cliente_id: document.getElementById('contratoCliente').value || null,
    valor: Number(document.getElementById('contratoValor').value) || null,
    data_emprestimo: document.getElementById('contratoData').value || null,
    vencimento: document.getElementById('contratoVencimento').value || null,
  };

  fetchJson('/contratos', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
    .then(() => {
      displayMessage(contratoMessage, 'Contrato salvo com sucesso.');
      contratoForm.reset();
      loadContracts();
      loadDashboard();
    })
    .catch((error) => displayMessage(contratoMessage, error.message, true));
});

senhaForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;

  if (!currentPassword || !newPassword) {
    displayMessage(senhaMessage, 'Preencha as senhas corretamente.', true);
    return;
  }

  fetchJson('/profile/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
    .then(() => {
      displayMessage(senhaMessage, 'Senha atualizada com sucesso.');
      senhaForm.reset();
    })
    .catch((error) => displayMessage(senhaMessage, error.message, true));
});

function initializeApp() {
  const token = getToken();
  if (!token) {
    hideApp();
    return;
  }

  fetchJson('/profile')
    .then((data) => {
      showApp();
      profileUsername.textContent = data.username || 'Administrador';
      refreshAll();
    })
    .catch(() => {
      setToken(null);
      hideApp();
    });
}

initializeApp();

