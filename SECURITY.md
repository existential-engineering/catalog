# Security Policy

## Reporting a Vulnerability

Please report security issues privately rather than opening a public issue:

- **Preferred:** use GitHub's private vulnerability reporting via
  [Report a vulnerability](https://github.com/existential-engineering/catalog/security/advisories/new)
- **Email:** [jeff@aureo.audio](mailto:jeff@aureo.audio)

## Scope

This repository primarily contains data files (YAML) and build scripts. Security concerns might include:

- Issues in the validation or build scripts
- Malicious content in data files
- CI/CD workflow issues

## Response

We will acknowledge receipt within 48 hours and provide a detailed response
within 7 days. Please allow us a reasonable disclosure window to investigate
and ship a fix before any public disclosure.

## Release Integrity

Every release of `catalog.sqlite` ships with a SHA-256 checksum, a
[minisign](https://jedisct1.github.io/minisign/) signature
(`catalog.sqlite.minisig`), and an SPDX SBOM. Verify downloads against these
before use.
