# FastSun

This SPA display CDN manager (Fastly).

> [!CAUTION]
> **This project is owned by the Upsun Advocacy team. It is in early stage of development [experimental] and only intended to be used with caution by Upsun customers/community.   <br /><br />This project is not supported by Upsun and does not qualify for Support plans. Use this repository at your own risks, it is provided without guarantee nor warranty!**  
> Don’t hesitate to join our [Discord](https://discord.com/invite/platformsh) to share your thoughts about this project.

## Usage

> Note : Currently Read-only and purge all application URLs behind the CDN.

Open on your browser : [https://fastsun.plugins.pltfrm.sh/](https://fastsun.plugins.pltfrm.sh/)

Enter your :
- FASTLY_ID
- FASTLY_TOKEN

Enjoy !

## Features

FastSun provides a comprehensive web interface to manage your Fastly CDN through the Fastly API. The interface allows you to:

### 📊 **Service Overview & Monitoring**
- View CDN service details and configuration summary
- Monitor real-time statistics and performance metrics
- Track service activity and recent events history
- View current VCL version and service status

### 🛡️ **Access Control Lists (ACLs)**
- View and manage Access Control Lists for your service
- Browse ACL entries (IP addresses, CIDR blocks)
- Update ACL configurations to control traffic access
- Manage security rules and restrictions

### 🔧 **VCL Configuration**
- Browse VCL (Varnish Configuration Language) versions
- View generated VCL content and configurations

### 🧹 **Cache Purging**
- **Purge All**: Clear entire CDN cache with one click
- **Selective Purging**: Purge specific URLs or content
- Real-time purge status and confirmation

### 🔐 **Security & Credentials**
- Secure credential storage (stored locally in browser only)
- Encrypted token management for enhanced security
- No third-party credential sharing

### 📈 **Real-time Analytics**
- Access real-time CDN performance data
- Monitor traffic patterns and cache hit rates
- Track bandwidth usage and request metrics

All interactions with your Fastly service are performed through the official Fastly API, ensuring reliable and up-to-date access to your CDN configuration and metrics.


### Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

### Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.


### Project Setup

```sh
npm install
```

#### Compile and Hot-Reload for Development

```sh
npm run dev
```

#### Type-Check, Compile and Minify for Production

```sh
npm run build
```

#### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

#### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
