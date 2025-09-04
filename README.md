# REST MCP Server Setup Guide

## Steps to Get Started

1. **Clone the repository**
   ```sh
   git clone <repo-url>
   cd rest-mcp-server
   ```

2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Build the project**
   ```sh
   npm run build
   ```

4. **Update variables in `.vscode/mcp.json`**
   - Open `.vscode/mcp.json` and set the required variables as per your environment.

5. **Update `updateabsolutepath` in `ars` of `.vscode/mcp.json`**
   - Ensure the `updateabsolutepath` field under the `ars` section in `.vscode/mcp.json` is set to the correct absolute path for your setup.

---

For any issues, please refer to the documentation or contact the maintainer.
