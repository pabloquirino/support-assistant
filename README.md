# Assistant Support

Ferramenta interna de apoio ao suporte com aparência de chat. O analista descreve o problema do cliente, o sistema encontra o procedimento cadastrado e, quando há condições (Pix, boleto, cartão...), faz perguntas guiadas antes de mostrar a solução.

**100% determinístico, sem IA.** A busca normaliza o texto (minúsculas, sem acentos) e ranqueia por título, palavras-chave/sinônimos e conteúdo. Toda resposta vem do que foi cadastrado no admin.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Pré-requisitos](#pré-requisitos)
- [Subir com Docker Compose](#subir-com-docker-compose)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Usuários, perfis e login](#usuários-perfis-e-login)
- [Rodar sem Docker (desenvolvimento)](#rodar-sem-docker-desenvolvimento)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Como cadastrar conteúdo](#como-cadastrar-conteúdo)
- [Métricas](#métricas)
- [Backup e restauração](#backup-e-restauração)
- [Endpoints principais](#endpoints-principais)
- [Solução de problemas](#solução-de-problemas)

## Funcionalidades

**Chat (Analista e Admin)**
- Busca por texto livre ou navegação por categorias e assuntos.
- Perguntas encadeadas com **Voltar** e **Recomeçar**.
- Solução em blocos: passo a passo com checklist, mensagem ao cliente e modelo de ticket com botão **Copiar**, observações, alertas e PDFs para download.
- Feedback "Isso resolveu?" em cada solução.

**Administração (só Admin, em `/admin`)**
- CRUD de categorias, assuntos, nós (perguntas e soluções), blocos e anexos PDF.
- Validações: sem ciclos na árvore, destino sempre no mesmo assunto, exclusões protegidas e upload validado pelo conteúdo do arquivo.
- Gestão de usuários: criar, ativar/desativar, mudar perfil e redefinir senha.
- Métricas: buscas sem resultado e taxa de "resolveu" por solução.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front | Angular 22 (standalone, signals) + Tailwind CSS v4, servido por nginx |
| Back | .NET 10 Web API (minimal APIs, um projeto organizado por features) + EF Core 10 |
| Banco | SQL Server 2022 (container) |
| Autenticação | Cookie HttpOnly + proteção CSRF por header, senhas com PBKDF2 (ASP.NET Core Identity `PasswordHasher`) |
| Infra | Docker Compose: serviços `db`, `api` e `web`, volumes `db-data` e `files-data` |

O navegador só fala com o nginx (`web`). Ele serve o Angular e faz proxy de `/api/*` para a API. Front e API ficam na **mesma origem**, o que dispensa CORS e permite o cookie `SameSite=Strict`.

## Pré-requisitos

- **Docker** com Docker Compose v2 (Docker Desktop no Windows/macOS).
- Cerca de 2 GB de RAM livres para o SQL Server.
- Só para rodar sem Docker: [.NET SDK 10](https://dotnet.microsoft.com/download), Node.js 22+ e um SQL Server acessível.

## Subir com Docker Compose

```bash
git clone <url-do-repositorio> assistant-support
cd assistant-support

cp .env.example .env
# edite o .env: no mínimo SA_PASSWORD, ADMIN_EMAIL e ADMIN_PASSWORD

docker compose up -d --build
```

Na primeira subida, a API aplica as migrations, cria o administrador inicial e, com `DB_SEED=true`, cadastra conteúdo de exemplo.

| Serviço | Endereço |
| --- | --- |
| Aplicação | http://localhost:8080 (`WEB_PORT`) |
| API direta (só dev) | http://localhost:5000/api/health (`API_PORT`) |
| SQL Server (só dev) | `localhost,1433` (`DB_PORT`) |

Entre com o `ADMIN_EMAIL` e o `ADMIN_PASSWORD` do `.env`.

> **API e banco expostos só em desenvolvimento.** O arquivo `docker-compose.override.yml` publica as portas da API e do banco e é carregado automaticamente pelo `docker compose`. Em produção, suba só o arquivo principal para expor apenas o nginx:
>
> ```bash
> docker compose -f docker-compose.yml up -d --build
> ```

Comandos úteis:

```bash
docker compose logs -f api         # logs da API
docker compose ps                  # estado e healthchecks
docker compose down                # para (os dados nos volumes continuam)
docker compose down -v             # para e APAGA banco e PDFs
```

## Variáveis de ambiente

Todas ficam no `.env` da raiz (modelo em `.env.example`). O `.env` está no `.gitignore`: nunca o versione.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `SA_PASSWORD` | (obrigatória) | Senha do usuário `sa` do SQL Server. Exige 8+ caracteres com maiúscula, minúscula, número e símbolo. **Sem aspas, `;` ou espaços** (ver [solução de problemas](#solução-de-problemas)). |
| `DB_NAME` | `AssistantSupport` | Nome do banco. |
| `WEB_PORT` | `8080` | Porta do nginx no host. |
| `API_PORT` | `5000` | Porta da API no host (só com o override de dev). |
| `DB_PORT` | `1433` | Porta do SQL Server no host (só com o override de dev). |
| `UPLOAD_MAX_MB` | `10` | Tamanho máximo de cada PDF. Ao aumentar, ajuste também o nginx. |
| `DB_AUTO_MIGRATE` | `true` | Aplica as migrations do EF Core ao subir a API. |
| `DB_SEED` | `true` | Cadastra conteúdo de exemplo **se o banco não tiver categorias**. Use `false` em produção. |
| `ADMIN_EMAIL` | (vazia) | E-mail do primeiro administrador. |
| `ADMIN_PASSWORD` | (vazia) | Senha do primeiro administrador (8 a 128 caracteres). |
| `ADMIN_NAME` | `Administrador` | Nome exibido do primeiro administrador. |
| `SESSION_HOURS` | `8` | Duração da sessão em horas. A sessão é renovada enquanto houver uso. |

Configurações internas da API (via `appsettings.json` ou variáveis no formato `Secao__Chave`):

| Chave | Descrição |
| --- | --- |
| `ConnectionStrings__Default` | Montada pelo compose a partir de `SA_PASSWORD` e `DB_NAME`. |
| `Storage__Path` | Pasta dos PDFs (`/app/storage` no container, volume `files-data`). |
| `DataProtection__KeysPath` | Pasta das chaves que cifram cookies e tokens CSRF. Padrão: `<Storage__Path>/keys`. |

## Usuários, perfis e login

| Perfil | Acesso |
| --- | --- |
| **Analista** | Chat: busca, fluxos, soluções, download de PDFs e feedback. |
| **Admin** | Tudo do analista, mais `/admin` (conteúdo, usuários e métricas). |

- **Primeiro admin:** a API cria esse usuário a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD` ao subir, **somente enquanto não existir nenhum admin no banco**. Isso vale mesmo com `DB_SEED=false`. Depois de criado, mudar essas variáveis não altera nada. Troque a senha pela tela de usuários e, se quiser, remova a senha do `.env`.
- **Demais usuários:** em **Administração → Usuários**. O admin cria a conta com uma senha inicial e a repassa ao usuário. Não há envio de e-mail.
- **Desativar ou rebaixar** um usuário vale na próxima requisição dele, sem esperar a sessão expirar.
- **Proteções:** um admin não pode desativar nem rebaixar a própria conta, e o sistema sempre mantém ao menos um admin ativo.
- **Esqueceu a senha:** outro admin redefine em **Usuários → Redefinir senha**. Se não houver outro admin, veja a [solução de problemas](#solução-de-problemas).

**Como a sessão funciona:**
- O login gera o cookie `as_session` (HttpOnly e `SameSite=Strict`), que o JavaScript não consegue ler.
- Toda requisição que altera dados (`POST`, `PUT` e `DELETE` em `/api`) precisa do header `X-XSRF-TOKEN`. Esse header copia o valor do cookie `XSRF-TOKEN`, que a API emite em `GET /api/auth/session`. O `HttpClient` do Angular envia o header automaticamente.
- O login tem limite de 10 tentativas por minuto por IP.
- As senhas são gravadas com hash PBKDF2 (formato do ASP.NET Core Identity), nunca em texto puro.

> **HTTPS:** em rede interna sem TLS, o cookie trafega em claro. Para expor fora da rede, coloque um proxy com HTTPS na frente do nginx (ou configure TLS no próprio nginx). A API respeita o `X-Forwarded-Proto` e passa a marcar os cookies como `Secure` automaticamente.

## Rodar sem Docker (desenvolvimento)

**1. Banco.** Use um SQL Server local ou suba só o container do banco:

```bash
docker compose up -d db
```

**2. API** (porta 5000, a mesma esperada pelo `proxy.conf.json`):

```bash
cd api/src/AssistantSupport.Api

# admin inicial só para desenvolvimento local (fica fora do repositório)
dotnet user-secrets init
dotnet user-secrets set "Admin:Email" "admin@local.test"
dotnet user-secrets set "Admin:Password" "uma-senha-local"

# se a senha do SA for diferente da de appsettings.json:
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost,1433;Database=AssistantSupport;User Id=sa;Password=<SA_PASSWORD>;TrustServerCertificate=True"

dotnet run --urls http://localhost:5000
```

**3. Front:**

```bash
cd web
npm ci
npx ng serve --proxy-config proxy.conf.json
```

Acesse http://localhost:4200.

> A senha que aparece em `appsettings.json` serve **apenas para desenvolvimento local**. Em container, a connection string vem do compose (`SA_PASSWORD`).

**Nova migration** (depois de alterar entidades em `Domain/` ou o `AppDbContext`):

```bash
cd api/src/AssistantSupport.Api
dotnet tool install --global dotnet-ef   # uma vez
dotnet ef migrations add NomeDaMudanca --output-dir Data/Migrations
```

## Estrutura de pastas

```
.
├── docker-compose.yml            # db, api, web + volumes db-data e files-data
├── docker-compose.override.yml   # dev: publica portas da API e do banco
├── .env.example                  # modelo das variáveis
├── api/
│   ├── Dockerfile
│   └── src/AssistantSupport.Api/
│       ├── Program.cs            # composição: serviços, auth, rotas /api
│       ├── Common/               # TextNormalizer (busca), FileStorage (PDFs)
│       ├── Domain/               # entidades e enums
│       ├── Data/
│       │   ├── AppDbContext.cs
│       │   ├── DatabaseInitializer.cs   # migrations + seeds ao subir
│       │   ├── Migrations/
│       │   └── Seed/             # DbSeeder (exemplos), AdminSeeder (admin inicial)
│       └── Features/
│           ├── Auth/             # login/logout/sessão, cookie, CSRF, políticas
│           ├── Catalog/          # categorias e assuntos publicados
│           ├── Search/           # busca + SearchLog
│           ├── Flow/             # navegação pela árvore de nós
│           ├── Attachments/      # download de PDF
│           ├── Feedbacks/        # "Isso resolveu?"
│           ├── Admin/            # CRUD de conteúdo e upload
│           ├── Users/            # gestão de usuários
│           └── Metrics/          # buscas sem resultado e feedbacks
└── web/
    ├── Dockerfile
    ├── nginx.conf                # SPA + proxy /api e limite de upload
    ├── proxy.conf.json           # proxy do ng serve em dev
    └── src/app/
        ├── core/                 # ApiService, AuthService, guards/interceptor, Markdown
        └── features/
            ├── auth/             # tela de login
            ├── chat/             # chat, fluxo e painel de solução
            └── admin/            # shell, conteúdo, editor de assunto, usuários, métricas
```

## Como cadastrar conteúdo

O conteúdo segue esta hierarquia: **Categoria → Assunto → árvore de nós**. Cada nó é uma **Pergunta** (com opções que levam a outros nós) ou uma **Solução** (com blocos).

```
Financeiro (categoria)
└── Pagamento não processado (assunto)
    └── Pergunta: "Qual foi a forma de pagamento?"   ← nó raiz
        ├── Pix    → Pergunta: "Foi há mais de 1 hora?"
        │            ├── Sim → Solução: Pix há mais de 1 hora
        │            └── Não → Solução: Pix há menos de 1 hora
        ├── Boleto → Solução: Boleto não baixado
        └── Cartão → Solução: Cartão recusado ou pendente
```

1. **Categoria:** em **Administração → Conteúdo**, informe o nome e a ordem de exibição. Só categorias ativas aparecem no chat.
2. **Assunto:** escolha a categoria e o título, depois clique em editar.
   - **Palavras-chave e sinônimos** alimentam a busca. Cadastre como o analista escreveria ("pgto não caiu", "boleto não baixou").
   - Um assunto só aparece no chat quando está **ativo** e tem um **nó raiz** definido.
3. **Fluxo:** crie os nós do assunto.
   - **Pergunta:** texto da pergunta e opções. Cada opção aponta ("Levar para…") para outro nó **do mesmo assunto**. O sistema recusa ciclos.
   - **Solução:** título, resumo e blocos.
   - Marque um nó como **raiz**. Se o problema não tiver condições, a raiz pode ser direto uma solução.
4. **Blocos da solução**, reordenáveis com ↑ ↓:

   | Tipo | No chat |
   | --- | --- |
   | `Steps` | Passo a passo com checklist |
   | `CustomerMessage` | Mensagem ao cliente com botão Copiar |
   | `Ticket` | Modelo de ticket com botão Copiar |
   | `Attachments` | Lista de PDFs para download |
   | `Note` | Observação |
   | `Warning` | Alerta destacado |

   O conteúdo aceita Markdown (negrito, listas, links), que é sanitizado antes de exibir. Blocos marcados como "recolhido" abrem fechados (acordeão).
5. **Anexo PDF:** salve a solução com um bloco do tipo `Attachments` e envie os PDFs nesse bloco.
   - O arquivo é validado pelo conteúdo (assinatura `%PDF-`), não só pela extensão, e respeita o limite `UPLOAD_MAX_MB`.
   - Os PDFs ficam no volume `files-data`, com nome `{guid}.pdf`.

Para revisar, abra o chat (**Ir para o chat**) e percorra o fluxo como um analista faria.

## Métricas

Em **Administração → Métricas**, filtrando por 7, 30 ou 90 dias:

- **Buscas sem resultado:** termos que não encontraram assunto, agrupados pelo texto normalizado, com contagem e última ocorrência. Use essa lista para criar palavras-chave, sinônimos ou assuntos novos.
- **Soluções com mais "não resolveu":** candidatas a revisão de procedimento.
- **Taxa de "resolveu" por solução.** Feedbacks de soluções já excluídas aparecem agrupados em "Soluções excluídas", porque o título fica guardado no feedback.

Cada busca e cada feedback guardam o usuário que os fez (`UserId`).

## Backup e restauração

Há dois volumes, e **eles devem ser salvos e restaurados juntos**: o banco referencia os PDFs pelo id, e o volume `files-data` guarda também as chaves de sessão (`keys/`).

O nome real do volume leva o prefixo do projeto (`assistant-support_db-data`, `assistant-support_files-data`). Confira com `docker volume ls`. Os comandos abaixo usam sintaxe bash. No PowerShell, troque `$(pwd)` por `${PWD}` e `\` por `` ` ``.

**Backup do banco** (backup nativo do SQL Server, sem parar o sistema):

```bash
mkdir -p backups
docker compose exec db /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$SA_PASSWORD" \
  -Q "BACKUP DATABASE [AssistantSupport] TO DISK = N'/var/opt/mssql/backup.bak' WITH INIT, COMPRESSION"
docker compose cp db:/var/opt/mssql/backup.bak ./backups/assistant-support-$(date +%F).bak
```

**Backup dos PDFs e das chaves:**

```bash
docker run --rm -v assistant-support_files-data:/data -v "$(pwd)/backups":/backup alpine \
  tar czf /backup/files-$(date +%F).tar.gz -C /data .
```

**Restauração** (com a aplicação parada para não haver escrita no meio):

```bash
docker compose stop api web

# PDFs e chaves
docker run --rm -v assistant-support_files-data:/data -v "$(pwd)/backups":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/files-AAAA-MM-DD.tar.gz -C /data && chown -R 1654:1654 /data"

# banco
docker compose cp ./backups/assistant-support-AAAA-MM-DD.bak db:/var/opt/mssql/restore.bak
docker compose exec db /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$SA_PASSWORD" \
  -Q "RESTORE DATABASE [AssistantSupport] FROM DISK = N'/var/opt/mssql/restore.bak' WITH REPLACE"

docker compose start api web
```

(`1654` é o UID do usuário `app` da imagem `aspnet`, que precisa de escrita na pasta.)

> As chaves em `files-data/keys` ficam sem criptografia em disco (a API registra um aviso sobre isso ao subir). Trate o backup desse volume como dado sensível.

## Endpoints principais

Todos ficam sob `/api`. Sem sessão, a API responde `401`. Sem o perfil exigido, `403`. Requisições que alteram dados sem o header `X-XSRF-TOKEN` válido recebem `400` com `{ "code": "csrf" }`.

| Método e rota | Acesso | Descrição |
| --- | --- | --- |
| `GET /health` | público | Healthcheck |
| `GET /auth/session` | público | Usuário atual (ou `null`) e emissão do cookie `XSRF-TOKEN` |
| `POST /auth/login` | público | `{ email, password }` → cookie de sessão |
| `POST /auth/logout` | público | Encerra a sessão |
| `GET /categories` | logado | Categorias ativas |
| `GET /categories/{id}/topics` | logado | Assuntos publicados da categoria |
| `GET /search?q=` | logado | Busca (registra em `SearchLog`) |
| `GET /topics/{id}/start` | logado | Nó raiz do assunto |
| `GET /nodes/{id}` | logado | Qualquer nó (pergunta ou solução) |
| `GET /attachments/{id}/download` | logado | Download do PDF |
| `POST /feedback` | logado | `{ solutionId, resolved }` |
| `GET/POST/PUT/DELETE /admin/categories…` | Admin | Categorias |
| `GET/POST/PUT/DELETE /admin/topics…` | Admin | Assuntos e nós (`/admin/topics/{id}/nodes`) |
| `PUT /admin/nodes/{id}/question` / `…/solution` | Admin | Edita pergunta ou solução e seus blocos |
| `POST /admin/blocks/{blockId}/attachments` | Admin | Upload de PDF (multipart, campo `file`) |
| `DELETE /admin/attachments/{id}` | Admin | Remove o PDF |
| `GET/POST /admin/users`, `PUT /admin/users/{id}` | Admin | Usuários |
| `POST /admin/users/{id}/password` | Admin | Redefine a senha |
| `GET /admin/metrics?days=30` | Admin | Métricas do período |

## Solução de problemas

**"Resposta inesperada da API" no `ng serve`**
Sem proxy, o `ng serve` responde `/api/*` com o `index.html` (HTML no lugar de JSON). Rode `npx ng serve --proxy-config proxy.conf.json` e confira se a API está em `http://localhost:5000`.

**Upload de PDF falha com 413 depois de aumentar `UPLOAD_MAX_MB`**
O nginx tem limite próprio: `client_max_body_size 12m` em `web/nginx.conf`. Deixe esse valor um pouco acima do novo limite (ex.: `UPLOAD_MAX_MB=20` → `22m`) e reconstrua com `docker compose up -d --build web`.

**O conteúdo de exemplo não apareceu, ou apareceu em produção**
`DB_SEED=true` só cadastra exemplos quando o banco **não tem nenhuma categoria**. Em produção, use `DB_SEED=false` desde a primeira subida. Se os exemplos já entraram, exclua-os pelo admin.

**API não conecta no banco / `Login failed for user 'sa'`**
- `SA_PASSWORD` não pode ter aspas, `;` ou espaços, porque é inserida na connection string.
- A senha precisa atender à política do SQL Server: 8+ caracteres com maiúscula, minúscula, número e símbolo. Senão o container `db` nem sobe (veja `docker compose logs db`).
- A senha do SA é definida **na criação do volume**. Mudar `SA_PASSWORD` depois não altera a senha do banco existente.

**Não consigo entrar / não existe admin**
- Veja `docker compose logs api`. Sem `ADMIN_EMAIL`/`ADMIN_PASSWORD`, a API avisa que nenhum admin foi criado. Defina as duas variáveis e rode `docker compose up -d api`.
- Se todos os admins perderam o acesso, rebaixe-os pelo banco para Analista. Na próxima subida, o admin do `.env` é criado de novo:
  `UPDATE Users SET Role = 'Analyst' WHERE Role = 'Admin';`

**"Sessão expirada ou requisição inválida" (400, `code: csrf`)**
O token CSRF não bate com a sessão, por exemplo quando a sessão expirou com a aba aberta. Recarregue a página. A tela de login renova o token sozinha.

**Todos foram deslogados depois de recriar os containers**
As chaves de sessão ficam em `files-data/keys`. Se esse volume foi apagado ou restaurado sem as chaves, as sessões antigas deixam de valer: basta entrar de novo.

**Backup restaurado, mas os PDFs dão 404**
O banco e o volume `files-data` foram restaurados de momentos diferentes. Restaure os dois do mesmo backup.

**A senha em `appsettings.json`**
É apenas para desenvolvimento local fora do Docker. Em container, a connection string vem do compose. Nunca use essa senha num banco acessível pela rede.
