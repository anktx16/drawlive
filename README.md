# DrawLive

DrawLive is a real-time collaborative drawing platform built as a full-stack TypeScript application. It provides shared drawing rooms where multiple users can interact with the same canvas in real time.

The project is designed around a monorepo architecture and separates the frontend, HTTP API, WebSocket layer, shared packages, and database access into independently maintainable workspaces.

## Overview

DrawLive combines a browser-based drawing interface with persistent application data and real-time event delivery.

The application uses:

- **Next.js / React** for the client application
- **Node.js** for backend services
- **WebSockets** for real-time collaboration
- **PostgreSQL** for persistent data
- **Prisma** for database access and migrations
- **JWT** for authentication
- **Turborepo + pnpm** for monorepo management

## Core Capabilities

- Real-time collaborative drawing rooms
- Multi-user room support
- Freehand drawing and canvas interactions
- Text and shape-based drawing operations
- Pan and zoom
- Undo / redo
- Geometric hit testing for object selection and erasing
- JWT-based authentication
- Persistent room and application data
- REST APIs for application operations
- WebSocket-based real-time synchronization
- Shared packages managed through a Turborepo workspace

## Architecture

```text
                         ┌─────────────────────────┐
                         │       Next.js App        │
                         │    apps/drawlive-fe      │
                         └────────────┬────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                       HTTP                    WebSocket
                         │                         │
                         ▼                         ▼
              ┌───────────────────┐     ┌───────────────────┐
              │    HTTP Backend    │     │ WebSocket Service │
              │ apps/http-backend  │     │      apps/ws      │
              └─────────┬─────────┘     └─────────┬─────────┘
                        │                         │
                        └────────────┬────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │  @repo/db   │
                              │    Prisma   │
                              └──────┬──────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │ PostgreSQL  │
                              └─────────────┘
```

### Request Flow

HTTP requests are used for operations that require request/response semantics, such as authentication and application data.

WebSockets provide a persistent connection for real-time drawing events.

```text
Browser
  │
  ├── HTTP ────────────────► HTTP API ─────────► PostgreSQL
  │
  └── WebSocket ──────────► WS Service
                              │
                              └── broadcasts events
                                  to connected clients
```

This separation keeps conventional API operations independent from the real-time communication layer.

## Repository Structure

```text
drawlive/
├── apps/
│   ├── drawlive-fe/          # Next.js frontend
│   ├── http-backend/         # HTTP / REST API
│   └── ws/                   # WebSocket service
│
├── packages/
│   ├── db/                   # Prisma schema and database client
│   ├── backend-common/       # Shared backend configuration/utilities
│   └── ...                   # Shared workspace packages
│
├── package.json              # Root workspace configuration
├── pnpm-workspace.yaml       # pnpm workspace definition
├── pnpm-lock.yaml
└── turbo.json                # Turborepo pipeline configuration
```

The repository is managed from the **root workspace**. Dependency installation, Turborepo commands, and lockfile management should therefore be performed from the repository root.

## Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| Next.js | React application framework |
| React | UI and client-side application logic |
| TypeScript | Static typing |
| Tailwind CSS | Styling |
| Axios | HTTP communication |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | Server-side runtime |
| Express | HTTP API |
| WebSockets | Real-time communication |
| JWT | Authentication |
| bcrypt | Password hashing |
| Zod | Runtime validation |

### Data Layer

| Technology | Purpose |
|---|---|
| PostgreSQL | Relational database |
| Prisma | ORM and schema management |
| pg | PostgreSQL driver |
| @prisma/adapter-pg | Prisma PostgreSQL adapter |

### Tooling

| Technology | Purpose |
|---|---|
| pnpm | Package management |
| Turborepo | Monorepo orchestration |
| Netlify | Frontend deployment |
| Render | Backend deployment |
| Neon | PostgreSQL hosting |

## Getting Started

### Prerequisites

Install:

- Node.js 24.x
- pnpm 9.15.9
- PostgreSQL or a PostgreSQL-compatible database

Verify your environment:

```bash
node -v
pnpm -v
```

### Clone the Repository

```bash
git clone https://github.com/anktx16/drawlive.git
cd drawlive
```

### Install Dependencies

Run installation from the repository root:

```bash
pnpm install
```

For a reproducible installation:

```bash
pnpm install --frozen-lockfile
```

The workspace contains multiple applications and packages, so installing from an individual application directory is not the recommended workflow.

## Environment Configuration

Create the required environment variables for the services you are running.

A typical local configuration includes:

root env:
```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret
```

frontend env:
```env
NEXT_PUBLIC_HTTP_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3002
```

Do not commit secrets or production environment files to the repository.

## Database

The database package is located at:

```text
packages/db
```

Prisma configuration and schema files are maintained inside the package:

```text
packages/db/
├── prisma.config.ts
└── prisma/
    ├── schema.prisma
    └── migrations/
```

Generate Prisma Client with:

```bash
pnpm --filter @repo/db exec prisma generate
```

Apply existing production migrations with:

```bash
pnpm --filter @repo/db exec prisma migrate deploy
```

The Prisma client is generated as part of the database package installation lifecycle.

## Development

Start the development environment from the repository root:

```bash
pnpm dev
```

Turborepo coordinates the development tasks across the workspace.

### Build

Build all configured applications and packages:

```bash
pnpm turbo build
```

Build only the frontend:

```bash
pnpm turbo build --filter=drawlive-fe
```

Run the root build script:

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```

### Type Checking

```bash
pnpm check-types
```

## Real-Time Collaboration

The real-time layer is implemented using WebSockets.

A simplified event flow looks like this:

```text
Client A
   │
   │ drawing event
   ▼
WebSocket Server
   │
   ├──────────────► Client B
   ├──────────────► Client C
   └──────────────► Client D
```

The WebSocket connection is kept open while the user is connected to a drawing room. Drawing operations can therefore be propagated to other connected clients without relying on repeated HTTP polling.

In production, an HTTPS frontend should communicate with the WebSocket service over `wss://`.

## Drawing and Erasing

DrawLive uses geometric hit testing to determine whether a pointer interaction intersects a drawing object.

For example, freehand strokes can be evaluated using the distance between a point and a line segment. Shape-based elements can use bounding-box or geometry-based checks.

This approach allows erasing to be based on the actual position and geometry of an object rather than simply removing the most recently created element.

## Undo and Redo

Drawing operations are represented as actions and maintained in application history.

Conceptually:

```text
User Action
    │
    ▼
History
 ┌───────┐
 │ Draw  │
 │ Move  │
 │ Erase │
 │ Text  │
 └───────┘
    │
    ├── Undo
    └── Redo
```

This provides a predictable mechanism for navigating previous canvas operations.

## Authentication

The application uses JWT-based authentication.

The general flow is:

```text
Client
  │
  │ credentials
  ▼
HTTP API
  │
  │ validate credentials
  ▼
JWT
  │
  ▼
Client
  │
  │ authenticated requests
  ▼
Protected API / WebSocket
```

Passwords are hashed with bcrypt before persistence rather than being stored as plain text.

## Production Deployment

The project is structured so that its major services can be deployed independently.

```text
┌───────────────────────────────┐
│           Frontend            │
│            Netlify            │
└───────────────┬───────────────┘
                │
                ├──────── HTTP ──────────► Backend
                │                           Render
                │
                └────── WebSocket ────────► WS Service
                                            Render

                         Backend
                            │
                            ▼
                         Neon DB
```

## Engineering Decisions

### Monorepo

Turborepo keeps the frontend, backend services, database layer, and shared packages in a single repository while allowing individual workspaces to remain independently organized.

Benefits include:

- Shared TypeScript configuration
- Shared packages
- Consistent dependency management
- Task orchestration through Turborepo
- Incremental builds and caching

### HTTP + WebSocket Separation

REST APIs and WebSockets solve different problems.

HTTP is used for conventional application operations, while WebSockets are dedicated to low-latency event delivery. Keeping these concerns separate makes each service easier to reason about and deploy independently.

### PostgreSQL + Prisma

PostgreSQL provides the persistent relational data layer, while Prisma provides typed database access and schema/migration tooling.


## Project Goals

DrawLive was built as a practical full-stack project focused on understanding and implementing:

- Real-time systems
- WebSocket communication
- Full-stack TypeScript development
- Authentication
- Relational database design
- Prisma
- REST APIs
- Monorepo architecture
- Production deployment
- Collaborative application design

## Author

**Ankit Yadav**

B.Tech Computer Science & Engineering  
Vivekananda Global University

- GitHub: https://github.com/anktx16
- LinkedIn: https://www.linkedin.com/in/ankit-yadav-55a93b27b/
- Project: https://drawlive.netlify.app

## License

This project is intended as a personal portfolio and learning project.
