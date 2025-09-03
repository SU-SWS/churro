# churro
Cloud Hosting Usage Reporting with Recurring Output

## Usage
1. Add your Acquia API key and secret to a file called `.env.local` at the root of the repository directory:
```
ACQUIA_API_KEY=<key here>
ACQUIA_API_SECRET=<secret here>
NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID=<UUID here>
NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT=<integer here>
NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT=<integer here>

```
(no quotes)

2. Run `npm run dev`