# Contributing to Maltheron

Thank you for your interest in contributing to Maltheron!

## What is Maltheron?

Maltheron is an agent-native financial operating system for the M2M economy. It provides:
- x402/AP2 protocol support for autonomous agent transactions
- Real-time ledger with 0.1% transaction fee
- Wallet-based authentication (SIWE)
- Financial memory and tax liability tracking

## Open Core Model

Maltheron follows an **open core** model:
- **Open Source (MIT)**: Core protocol parsers, database schema, auth flow, dashboard UI
- **Proprietary**: Hosted SaaS platform, premium compliance features, enterprise tools

When contributing, keep this in mind - core infrastructure contributions are welcome!

## How to Contribute

### Reporting Bugs

1. Check if the bug already exists in issues
2. Create a detailed issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details

### Suggesting Features

1. Open an issue with `[FEATURE]` prefix
2. Describe the use case
3. Explain how it fits Maltheron's architecture

### Pull Requests

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Add tests if applicable
5. Ensure code passes: `bun test`
6. Commit with clear messages
7. Push and open a PR

### Coding Standards

- Use TypeScript
- Follow existing code style
- Add comments for complex logic
- Keep functions focused and small

## Development Setup

```bash
# Install dependencies
bun install

# Start development servers
bun run dev

# Run tests
bun test
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

- Open an issue for bugs/features
- For security issues, see SECURITY.md (if exists)
