# Nebula Infrastructure Manager

Nebula is a premium, lightweight infrastructure and inventory management dashboard designed for homelabs and small data centers. It provides a visual overview of physical servers, virtual machines, and network topology with integrated Proxmox and UniFi support.

![Nebula Banner](Branding/Brand%20Slim.png)

## 🚀 Key Features

- **Equipment Racks:** Organize your physical hardware into customized, draggable racks.
- **Proxmox Integration:** Pull VM and Container data directly from your Proxmox nodes.
- **UniFi Topology:** Automatically sync and map your UniFi network infrastructure (Switches, UDM, APs).
- **Network Planner:** A dynamic, interactive map of your entire infrastructure and its connections.
- **Dynamic Themes:** Customizable glass UI with multiple color palettes.
- **CSV Export:** Export your complete inventory to CSV with a single click.

## 📦 Deployment

The easiest way to run Nebula is using Docker.

### Using Docker (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/nebula.git
   cd nebula
   ```

2. **Build and Run:**
   ```bash
   docker build -t nebula-app .
   docker run -d -p 80:80 --name nebula-app nebula-app
   ```

3. **Access the Dashboard:**
   Open your browser and navigate to `http://localhost`.

### Manual Installation (Development)

1. **Install Python dependencies:**
   ```bash
   pip install flask proxmoxer requests urllib3
   ```

2. **Run the application:**
   ```bash
   python app.py
   ```

## 🛠️ Configuration

- **Proxmox:** Add a server on the dashboard and click the "Pull from Proxmox" button in the service modal.
- **UniFi:** Navigate to the "Network Planner" and use the "Connect UniFi" button.
- **Persistence:** All data is stored in a local `data.db` SQLite file.

## 🖼️ Screenshots

<p align="center">
  <img src="Branding/Default%20Home.png" width="400" alt="Home Dashboard">
  <img src="Branding/Network.png" width="400" alt="Network Planner">
</p>
<p align="center">
  <img src="Branding/Racks.png" width="400" alt="Rack Management">
  <img src="Branding/Settings.png" width="400" alt="Settings">
</p>
<p align="center">
  <img src="Branding/UniFI%20Add.png" width="400" alt="UniFi Integration">
</p>

## 🤝 Credits

Created with ❤️ by **RealSheepCounter**.

---
*Note: This project is in active development. For production use, ensure proper firewall/ACL rules are in place as this manages infrastructure credentials.*

