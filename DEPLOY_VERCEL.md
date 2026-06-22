Passos para deploy do backend no Vercel com banco Postgres (Supabase)

Resumo:
- O repo já contém uma API serverless em `api/[...slug].js` que usa `process.env.DATABASE_URL` e `process.env.JWT_SECRET`.
- O frontend (em `public/`) continua como está; depois do deploy atualize `public/app.js` para apontar `apiBase` para a URL do Vercel (ex.: `https://meu-app.vercel.app/api`).

1) Criar projeto Supabase (Postgres)
- Vá a https://app.supabase.com e crie um novo projeto.
- Após criar, em Settings > Database > Connection string copie `DATABASE_URL` (ou `Connection string (URI)`).

2) Configurar variáveis de ambiente no Vercel
- Crie uma conta em https://vercel.com e faça login.
- Conecte o repositório GitHub deste projeto ao Vercel (New Project → Import Git Repository).
- No painel do projeto Vercel, abra Settings → Environment Variables e adicione:
  - `DATABASE_URL` = (valor obtido do Supabase)
  - `JWT_SECRET` = (uma string secreta longa, ex.: `s3nh4_super_secreta`)

3) Dependências e build
- O projeto já tem `package.json`. A API serverless não necessita de comando de build especial.
- Vercel executará `npm install` automaticamente.

4) Ajustar `public/app.js` (frontend)
- Depois que o projeto estiver deployado, pegue a URL do deployment (ex.: `https://my-project-abc.vercel.app`).
- Abra `public/app.js` e atualize `const apiBase = '/api';` (ou a definição atual) para:
  `const apiBase = 'https://SEU_PROJETO.vercel.app/api';`
- Commit e push dessa alteração para `main`.

5) Testar
- Abra a URL do Vercel e tente login via frontend (ou faça POST direto para `https://SEU_PROJETO.vercel.app/api/login`).
- Credenciais iniciais: `admin` / `admin123` (criado automaticamente no primeiro start).

Notas importantes:
- Em produção, recomendo usar hashing mais forte (bcrypt) e configurar backups do banco.
- A função serverless adiciona cabeçalhos CORS permitindo origens externas (Access-Control-Allow-Origin: *).

Se quiser, eu posso:
- Atualizar `public/app.js` automaticamente para apontar para a URL do Vercel (quando você me der a URL final),
- Ou orientar passo-a-passo enquanto você cria o projeto no Supabase e conecta no Vercel.

Quer que eu gere o commit para `public/app.js` com o `apiBase` já preenchido se você me passar a URL do Vercel agora?