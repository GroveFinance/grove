<style>
  table td {
    border: none !important;
  }
</style>
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="frontend/public/grove_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="frontend/public/grove_light.png">
    <img alt="Grove" src="frontend/public/grove_light.png">
  </picture>
</p>

# Grove

**Grove** is a self-hosted personal finance management tool that helps you track, categorize, and visualize your financial life. Sync your accounts automatically, manage budgets, and gain insights into your spending patterns - all while keeping your financial data under your control.

> **🌐 [Try the Live Demo](https://grovefinance.github.io/grove/)** - No installation required! See Grove in action with (somewhat) realistic mock data. Its all mock data so there is no ability to edit or change anything.

## What is Grove?

Grove is my attempt to build a modern, self-hosted personal finance manager that is easy to use and powerful enough for everyday financial tracking. It leverages [SimpleFin](https://simplefin.org) for automatic account syncing, allowing you to connect your bank accounts, credit cards, and investment accounts with ease.

- **Automatic Account Syncing** - Connect your bank accounts, credit cards, and investment accounts through SimpleFin
- **Transaction Management** - Categorize transactions, split expenses across categories, and manage payees
- **Budget Tracking** - Set budgets by category and monitor spending against targets
- **Financial Insights** - Dashboard widgets showing account summaries, spending trends, and cash flow analysis
- **Investment Tracking** - Monitor holdings, positions, and portfolio performance

## Why Grove?

<table border="0" width="100%">
  <tr>
    <td style="vertical-align: top;">
      <picture>
         <source media="(prefers-color-scheme: dark)" srcset="images/dark.png">
         <source media="(prefers-color-scheme: light)" srcset="images/light.png">
         <img alt="Grove" src="frontend/public/grove_light.png">
      </picture>
    </td>
    <td style="vertical-align: top; padding-left: 16px;">
      <p>
        Im just a squirrel trying to keep track of my nuts. I was a mildly happy user of Mint but once it shutdown I wasnt able to find the right replacement. A lot of the newer tools were more than i wanted to spend and focused far too much on budgeting and less on overall financial tracking. I also wanted something I could self-host to ensure my financial data stayed private and secure. Grove is designed to be simple to set up and use, while still providing powerful features for managing your finances.
      </p>
    </td>
  </tr>
</table>


## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- A SimpleFin account and access token (sign up at [simplefin.org](https://simplefin.org))


### Installation

1. **Get the Docker Compose File**
   
   ```bash
   curl -o docker-compose.yml https://raw.githubusercontent.com/grovefinance/grove/main/docker-compose.yml
   ``` 

2. **Configure Environment Variables**

   Really you should just set the POSTGRES_PASSWORD in a .env or in the docker-compose.yml directly. The rest of the defaults are probably fine for most users.

3. **Start Grove**
   ```bash
   docker compose up -d
   ```

## Support & Contributing

- **Issues**: Report bugs or request features via GitHub Issues
- **Documentation**: See [CLAUDE.md](CLAUDE.md) for architecture details
- **Contributing**: Pull requests welcome! Please maintain existing code patterns.
