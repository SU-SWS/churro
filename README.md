# CHURRO
Cloud Hosting Usage Reporting with Recurring Output

## Development Setup

### 1. Install Dependencies

Install the correct Node version and dependencies:
```bash
nvm use
npm install
```
This ensures all developers use the same Node version as production (Vercel's Node 22.x).

### 2. Environment Configuration

Create a `.env.local` file at the root of the repository with the following variables:

```env
# Application URL (local development)
APP_URL=https://localhost:3000

# JWT Configuration (generate with: openssl rand -base64 32)
JWT_SECRET=your-secure-secret-here

# Acquia Cloud API
ACQUIA_API_KEY=<key here>
ACQUIA_API_SECRET=<secret here>
ACQUIA_API_BASE_URL=https://cloud.acquia.com/api
ACQUIA_AUTH_BASE_URL=https://accounts.acquia.com/api
NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID=<UUID here>
NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT=<integer here>
NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT=<integer here>

# Stanford SAML SSO (see docs/SAML.md for details)
SAML_ENTRY_POINT=https://login-uat.stanford.edu/idp/profile/SAML2/Redirect/SSO
SAML_ENTITY_ID=https://churro-test.stanford.edu
SAML_CERT="-----BEGIN CERTIFICATE-----..."
SAML_SP_CERT="-----BEGIN CERTIFICATE-----..."
SAML_SP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
```

**Note**: No quotes around values (except multi-line certificates).

See [docs/SAML.md](docs/SAML.md) for complete SAML configuration instructions.

### 3. Local HTTPS Setup (Required for SAML)

Stanford's SAML IdP requires HTTPS. Set up local HTTPS with mkcert:

```bash
# Install mkcert
brew install mkcert
mkcert -install

# Generate local certificates
mkdir -p .cert
mkcert -key-file .cert/localhost-key.pem -cert-file .cert/localhost-cert.pem localhost 127.0.0.1 ::1
```

### 4. Start Development Server

```bash
# HTTP (basic development without SAML)
npm run dev

# HTTPS (required for SAML authentication)
npm run dev:https
```

Then open:
- HTTP: [http://localhost:3000](http://localhost:3000)
- HTTPS: [https://localhost:3000](https://localhost:3000)

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_URL` | Application base URL | `https://localhost:3000` (dev) or `https://churro.stanford.edu` (prod) |
| `JWT_SECRET` | JWT signing secret | Generate with `openssl rand -base64 32` |
| `ACQUIA_API_KEY` | Acquia Cloud API key | `12345678-1234-1234-1234-123456789012` |
| `ACQUIA_API_SECRET` | Acquia Cloud API secret | `abcdef1234567890` |
| `ACQUIA_API_BASE_URL` | Acquia Cloud API URL | `https://cloud.acquia.com/api` |
| `ACQUIA_AUTH_BASE_URL` | Acquia Cloud API authentication URL | `https://accounts.acquia.com/api` |
| `NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID` | Acquia subscription identifier | `87654321-4321-4321-4321-210987654321` |
| `NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT` | Monthly views limit | `1000000` |
| `NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT` | Monthly visits limit | `100000` |
| `SAML_ENTRY_POINT` | Stanford IdP endpoint | `https://login-uat.stanford.edu/...` (UAT) |
| `SAML_CERT` | Stanford IdP certificate | Multi-line PEM format |
| `SAML_SP_CERT` | Your SP certificate | Multi-line PEM format |
| `SAML_SP_PRIVATE_KEY` | Your SP private key | Multi-line PEM format |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SAML_ENTITY_ID` | SAML entity ID (for local dev) | Falls back to `APP_URL` |

See `.env.example` for a complete template.


## Features

- 🔐 **Stanford SAML SSO** - Secure authentication via Stanford Identity Provider
- 📊 **Acquia Analytics** - View usage data for Acquia Cloud applications
- 📅 **Date Range Filtering** - Historical data analysis with custom date ranges
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎨 **Stanford Design System** - Built with Decanter (Stanford's design system)

## Scripts

- `npm run dev` - Start development server (HTTP)
- `npm run dev:https` - Start development server with HTTPS (required for SAML)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Authentication

This application uses **Stanford SAML SSO** with JWT-based sessions:

- All authentication flows through Stanford's Identity Provider
- Sessions stored in secure HTTP-only cookies
- Middleware protects routes requiring authentication
- Full support for Stanford attributes (SUNet ID, email, affiliations)

See [docs/SAML.md](docs/SAML.md) for complete authentication documentation.

## Deployment

This application is designed to deploy on Vercel with zero configuration. Environment variables should be configured in the Vercel dashboard.

