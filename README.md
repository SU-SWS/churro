# CHURRO
Cloud Hosting Usage Reporting with Recurring Output

## Development Setup

1. Install the correct Node version:
   ```bash
   nvm use
   npm install
   ```
   This ensures all developers use the same Node version as production (Vercel's Node 22.x).

2. Create environment configuration:
   Add your Acquia API credentials to a file called `.env.local` at the root of the repository:
   ```
   ACQUIA_API_KEY=<key here>
   ACQUIA_API_SECRET=<secret here>
   ACQUIA_API_BASE_URL=https://cloud.acquia.com/api
   ACQUIA_AUTH_BASE_URL=https://accounts.acquia.com/api
   NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID=<UUID here>
   NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT=<integer here>
   NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT=<integer here>
   ```
   (no quotes around values)

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ACQUIA_API_KEY` | Acquia Cloud API key | `12345678-1234-1234-1234-123456789012` |
| `ACQUIA_API_SECRET` | Acquia Cloud API secret | `abcdef1234567890` |
| `ACQUIA_API_BASE_URL` | Acquia Cloud API URL | `https://cloud.acquia.com/api` |
| `ACQUIA_AUTH_BASE_URL` | Acquia Cloud API authentication URL | `https://accounts.acquia.com/api` |
| `NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID` | Acquia subscription identifier | `87654321-4321-4321-4321-210987654321` |
| `NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT` | Monthly views limit | `1000000` |
| `NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT` | Monthly visits limit | `100000` |


## Features

- View analytics data for Acquia Cloud applications
- Date range filtering for historical data analysis
- Responsive design for desktop and mobile use

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Deployment

This application is designed to deploy on Vercel with zero configuration. Environment variables should be configured in the Vercel dashboard.

