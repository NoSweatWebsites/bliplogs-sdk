# Changelog

All notable changes to the BlipLogs SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
