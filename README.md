# Sistema de Gestão de Cobranças e Empréstimos

Sistema completo de gestão de cobranças e empréstimos, com backend em Node.js/Express e banco de dados SQLite, e frontend em HTML5, CSS3 e JavaScript Vanilla.

## Estrutura do projeto

- `server.js` - servidor Express, rotas da API e frontend estático
- `database.js` - criação das tabelas SQLite e usuário admin padrão
- `package.json` - dependências e comando de inicialização
- `.gitignore` - exclui `data/` e `node_modules/`
- `public/index.html` - interface do sistema com abas
- `public/style.css` - layout branco com detalhes em laranja
- `public/app.js` - lógica do frontend para consumo da API

## Instalação

1. Abra o terminal na pasta do projeto:

```powershell
cd "d:\Downloads\N8N Waha Local\Systema Jurista"
```

2. Instale as dependências:

```powershell
npm install
```

3. Inicie o servidor:

```powershell
npm start
```

4. Abra o sistema no navegador:

```text
http://localhost:3000
```

## Login padrão

- Usuário: `admin`
- Senha: `admin123`

> O sistema inicializa automaticamente com o usuário administrador padrão.

## Como usar

1. Acesse o painel com as credenciais do administrador.
2. Cadastre clientes na aba `Clientes`.
3. Crie contratos na aba `Contratos`, vinculando ao cliente.
4. Veja o total a receber e os lembretes no `Dashboard`.
5. Use o botão do WhatsApp para contatar o cliente de forma rápida.
6. Altere a senha do administrador na aba `Perfil / Segurança`.

## Observações

- O banco SQLite fica em `data/database.sqlite`.
- Todos os campos de cliente e contrato aceitam valor nulo no banco, conforme especificado.
- Se quiser alterar a senha do admin, faça login e use a aba `Perfil / Segurança`.

## Requisitos

- Node.js 16+ ou compatível

## Desenvolvimento

Se quiser fazer ajustes no frontend ou backend, basta editar os arquivos em `public/`, `server.js` e `database.js`.
