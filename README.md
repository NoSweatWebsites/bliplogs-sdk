# BlipLogs SDK

[![npm version](https://img.shields.io/npm/v/@bliplogs/sdk.svg)](https://www.npmjs.com/package/@bliplogs/sdk)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@bliplogs/sdk)](https://bundlephobia.com/package/@bliplogs/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Lightweight event tracking for browser and server. Zero dependencies, ~3 KB gzipped.

## Why BlipLogs?

- **Tiny** – ~3 KB gzipped, no dependencies
- **Universal** – Works in browsers, Node 18+, Cloudflare Workers, edge runtimes
- **Fast** – Uses `sendBeacon` for non-blocking delivery, falls back to `fetch`
- **Simple** – Configure once, track anywhere

## Installation

```bash
npm install @bliplogs/sdk
```

## Quick Start

```typescript
import BlipLogs from '@bliplogs/sdk';

BlipLogs.configure({
  apiKey: 'your-api-key',
  projectId: 'your-project-id'
});

BlipLogs.track('signup_clicked', { plan: 'pro' });
```

That's it. Three lines to start tracking.

## Log Levels

```typescript
BlipLogs.info('page_viewed', { page: '/dashboard' });
BlipLogs.warn('slow_request', { duration: 5000 });
BlipLogs.error('api_error', { status: 500 });
```

## Framework Examples

### React / Next.js

**1. Create `lib/bliplogs.ts`:**

```typescript
import BlipLogs from '@bliplogs/sdk';

BlipLogs.configure({
  apiKey: process.env.NEXT_PUBLIC_BLIPLOGS_API_KEY || '',
  projectId: process.env.NEXT_PUBLIC_BLIPLOGS_PROJECT_ID || ''
});
```

**2. Import in your app entry** (`app/layout.tsx` or `pages/_app.tsx`):

```typescript
import '../lib/bliplogs';
```

**3. Use anywhere:**

```tsx
import BlipLogs from '@bliplogs/sdk';

function SignupButton() {
  return (
    <button onClick={() => BlipLogs.track('signup_clicked')}>
      Sign Up
    
  );
}
```

### Astro

**1. Configure in your layout** (`src/layouts/Layout.astro`):

```astro
---
// Configuration runs at build time, but the SDK handles this gracefully
import BlipLogs from '@bliplogs/sdk';

BlipLogs.configure({
  apiKey: import.meta.env.PUBLIC_BLIPLOGS_API_KEY,
  projectId: import.meta.env.PUBLIC_BLIPLOGS_PROJECT_ID
});
---

<html>
  <body>
    <slot />
  </body>
</html>
```

**2. Track events with a script tag:**

```astro
<button id="signup">Sign Up</button>

<script>
  import BlipLogs from '@bliplogs/sdk';

  document.getElementById('signup')?.addEventListener('click', () => {
    BlipLogs.track('signup_clicked');
  });
</script>
```

**Or use a React/Svelte/Vue component with `client:load`:**

```astro
---
import SignupButton from '../components/SignupButton.tsx';
---

<SignupButton client:load />
```

### Vanilla JavaScript

```html

  import BlipLogs from './node_modules/@bliplogs/sdk/dist/index.mjs';

  BlipLogs.configure({
    apiKey: 'your-api-key',
    projectId: 'your-project-id'
  });

  document.getElementById('myButton').addEventListener('click', () => {
    BlipLogs.track('button_clicked');
  });

```

## Server-Side Usage

The SDK works anywhere with global `fetch`: Node 18+, Cloudflare Workers, Astro actions, and most serverless runtimes.

### Node.js

```typescript
import BlipLogs from '@bliplogs/sdk';

BlipLogs.configure({
  apiKey: process.env.BLIPLOGS_API_KEY!,
  projectId: process.env.BLIPLOGS_PROJECT_ID!
});

// In your request handler
BlipLogs.info('order_created', { orderId: '123', amount: 4999 });
```

### Cloudflare Workers

```typescript
import BlipLogs from '@bliplogs/sdk';

export default {
  async fetch(req: Request, env: Env) {
    BlipLogs.configure({
      apiKey: env.BLIPLOGS_API_KEY,
      projectId: env.BLIPLOGS_PROJECT_ID
    });

    BlipLogs.track('worker_request', {
      path: new URL(req.url).pathname,
      method: req.method
    });

    return new Response('OK');
  }
};
```

### Server-Side Limitations

| Feature | Browser | Server |
|---------|---------|--------|
| Session ID | ✓ Auto-generated | ✗ Not available |
| URL/Referrer/User Agent | ✓ Auto-captured | ✗ Not captured |
| Transport | sendBeacon → fetch | fetch only |

Pass any server-specific context via metadata:

```typescript
BlipLogs.track('api_request', {
  path: req.url,
  userAgent: req.headers['user-agent'],
  duration: 120
});
```

## Configuration Options

```typescript
BlipLogs.configure({
  apiKey: 'your-api-key',       // Required
  projectId: 'your-project-id', // Required
  debug: true,                  // Log errors to console
  onError: (error) => {         // Custom error handling
    console.error(error.type, error.message);
  },
  privacy: {                    // GDPR/privacy controls
    anonymizeIp: true,          // Don't store IP or geo data
    collectUrl: false,          // Don't collect page URL
    collectReferrer: false,     // Don't collect referrer
    collectUserAgent: false,    // Don't collect user agent
    collectSessionId: false     // Don't track sessions
  }
});
```

## API Reference

### `BlipLogs.configure(config)`

Configure the SDK. Call once at app startup.

### `BlipLogs.track(event, metadata?, level?)`

Track an event. Returns `boolean` indicating if the event was queued.

```typescript
BlipLogs.track('checkout_started', { cartValue: 99.99 }, 'info');
```

### `BlipLogs.info(event, metadata?)`
### `BlipLogs.warn(event, metadata?)`
### `BlipLogs.error(event, metadata?)`

Convenience methods for specific log levels.

### Instance-Based Usage

Need multiple configurations? Create instances:

```typescript
const analytics = new BlipLogs({
  apiKey: 'analytics-key',
  projectId: 'analytics-project'
});

const errors = new BlipLogs({
  apiKey: 'errors-key',
  projectId: 'errors-project'
});

analytics.track('page_view');
errors.error('unhandled_exception', { stack: '...' });
```

## Error Handling

The SDK is fire-and-forget by default – errors won't crash your app. Enable visibility when needed:

```typescript
BlipLogs.configure({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  debug: true,
  onError: (error) => {
    if (error.type === 'rate_limit') {
      console.warn('Rate limit hit');
    }
  }
});
```

**Error types:** `network`, `rate_limit`, `auth`, `validation`, `unknown`

## TypeScript

Full type definitions included:

```typescript
import BlipLogs, {
  BlipMetadata,
  BlipLevel,
  BlipLogsConfig,
  BlipLogsError,
  BlipContext,
  BlipPayload,
  BlipPrivacyConfig
} from '@bliplogs/sdk';
```

## How It Works

1. **Browser:** Uses `navigator.sendBeacon()` for fast, non-blocking delivery
2. **Fallback:** Automatically uses `fetch()` with `keepalive: true` if sendBeacon is unavailable
3. **Server:** Uses `fetch()` directly
4. **Context:** Auto-captures URL, referrer, and user agent in browsers

## Privacy

The SDK collects minimal data by default and provides controls for GDPR compliance.

### Data Collected

| Data | Default | Privacy Option |
|------|---------|----------------|
| Page URL | Collected | `collectUrl: false` |
| Referrer | Collected | `collectReferrer: false` |
| User Agent | Collected | `collectUserAgent: false` |
| Session ID | Generated | `collectSessionId: false` |
| IP Address | Stored server-side | `anonymizeIp: true` |

### Privacy-First Configuration

For maximum privacy (e.g., before cookie consent):

```typescript
BlipLogs.configure({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  privacy: {
    anonymizeIp: true,
    collectUrl: false,
    collectReferrer: false,
    collectUserAgent: false,
    collectSessionId: false
  }
});
```

### Automatic Protections

The SDK automatically redacts sensitive URL parameters:
- Auth tokens (`token`, `access_token`, `api_key`)
- OAuth params (`code`, `state`, `nonce`)
- PII (`email`, `phone`, `ssn`)
- Payment data (`credit_card`, `cvv`)

### Your Responsibilities

1. **Privacy policy** – Disclose BlipLogs in your privacy policy
2. **Consent** – Obtain consent if required (cookie banner)
3. **Data deletion** – Contact support for deletion requests

## Links

- [Dashboard](https://bliplogs.co.uk) – Sign up and manage projects
- [Documentation](https://bliplogs.co.uk/docs) – Full docs
- [GitHub Issues](https://github.com/NoSweatWebsites/bliplogs-sdk/issues) – Bugs and feature requests

## License

MIT