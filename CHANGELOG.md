# Changelog

All notable changes to the BlipLogs SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-02-06

### Fixed

- No longer throws during Next.js SSR pre-render of `'use client'` components when no `secretKey` is provided. The SDK now silently continues (warns in debug mode) instead of crashing the build.

## [0.2.0] - 2026-02-06

### Changed

- **Transport:** `fetch` with `keepalive: true` is now the primary transport (supports custom headers). `sendBeacon` is only used when `fetch` is unavailable; in that case a debug warning is logged and the public key is sent via query.
- **Config:** New `publicKey` (defaults to `projectId`) and `secretKey` options. The SDK sends `X-Blip-Public-Key` always and `X-Blip-Secret-Key` only on the server. In the browser, `secretKey` is never sent to avoid leaks.
- **Deprecated:** `apiKey` is deprecated in favor of `secretKey`; `apiKey` still works as an alias for server-side use.
- **Build:** Production build now uses `--minify` for smaller bundle size.

### Fixed

- Network and request errors are handled via `onError`/debug only; no unhandled exceptions (error-silence guardrail).

## [0.1.2] - 2025-02-06

### Added

- **Bandwidth tracking** - Monitor resource loads with `trackBandwidth` option
  - Uses PerformanceObserver for accurate resource timing data
  - Batched sending with configurable intervals
  - Automatic flushing on page visibility change
- **User agent parsing** - Structured browser, OS, and device detection
  - Bot detection for 25+ known crawlers (Googlebot, Bingbot, GPTBot, etc.)
  - Browser identification (Chrome, Firefox, Safari, Edge, Opera)
  - OS detection (Windows, macOS, iOS, Android, Linux)
  - Device type classification (desktop, mobile, tablet)
- **Optional API key for browser** - API key is now optional in browser environments
  - Uses origin validation with domain whitelisting
  - Server-side still requires API key
- **New exported types** - `BandwidthPayload`, `BandwidthResourceEntry`, `ParsedUserAgent`, `BlipBandwidthConfig`, `BandwidthResourceType`

### Changed

- `apiKey` is now optional in `BlipLogsConfig` (required only for server-side usage)
- Payloads now include `project_id` for browser SDK origin validation

## [0.1.0] - 2025-02-03

### Added

- Initial release of the BlipLogs SDK
- Zero-dependency event tracking for browser and server environments
- `BlipLogs.configure()` for global configuration
- `BlipLogs.track()` for general event tracking
- `BlipLogs.info()`, `BlipLogs.warn()`, `BlipLogs.error()` convenience methods
- Instance-based API for multiple configurations
- Automatic browser context capture (URL, referrer, user agent)
- Sensitive URL parameter redaction for privacy
- Session tracking with 30-minute timeout
- `sendBeacon` primary transport with `fetch` fallback
- Server-side support for Node 18+, Cloudflare Workers, and edge runtimes
- Debug mode and error callbacks for troubleshooting
- Full TypeScript support with exported types
