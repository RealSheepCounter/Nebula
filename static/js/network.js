document.addEventListener('appReady', (e) => {
    const servers = e.detail.servers;
    const networkDevices = e.detail.network_devices || [];
    const settings = e.detail.settings || {};

    renderNetwork(servers, networkDevices);
    renderNetworkGrid(networkDevices, settings);
});

function renderNetworkGrid(devices, settings) {
    const resultsContainer = document.getElementById('unifi-results');
    const deviceList = document.getElementById('unifi-device-list');

    if (devices.length === 0) {
        resultsContainer.style.display = 'none';
        return;
    }

    resultsContainer.style.display = 'block';
    deviceList.innerHTML = '';

    const group = document.createElement('div');
    group.className = 'rack-group';
    group.style.width = '100%';

    const header = document.createElement('div');
    header.className = 'rack-header';
    header.innerHTML = `
        <h2 class="rack-header-title network-header-title">Infrastructure & Manual Devices</h2>
        <span class="rack-location">${devices.filter(d => d.is_manual).length} Manual, ${devices.filter(d => !d.is_manual).length} Synced</span>
    `;
    group.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'dashboard-grid';
    grid.style.padding = '1rem';

    devices.forEach(dev => {
        const card = document.createElement('div');
        card.className = 'glass-panel server-card';
        card.style.padding = '1.5rem';
        card.style.cursor = dev.is_manual ? 'pointer' : 'default';
        if (dev.is_manual) {
            card.addEventListener('click', () => openManualDeviceModal(dev));
        }

        card.innerHTML = `
            <div class="server-header">
                <div class="server-title">
                    <h2 style="font-size: 1.1rem; color: ${dev.is_manual ? 'var(--accent-primary)' : 'var(--accent-secondary)'};">${window.escapeHTML(dev.name)}</h2>
                    <span class="server-ip">IP: ${window.escapeHTML(dev.ip || 'N/A')}</span>
                </div>
            </div>
            <div style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                <span>${window.escapeHTML(dev.brand || '')} / ${window.escapeHTML(dev.model || dev.type)}</span>
                <span style="text-transform: uppercase;">${window.escapeHTML(dev.type)}</span>
            </div>
        `;
        grid.appendChild(card);
    });

    group.appendChild(grid);
    deviceList.appendChild(group);

    header.querySelector('.network-header-title').addEventListener('click', () => {
        const modal = document.getElementById('modal-unifi-info');
        if (modal) {
            document.getElementById('unifi-info-name').textContent = 'Infrastructure Inventory';
            document.getElementById('unifi-info-host').textContent = settings.unifi_host || 'N/A';
            document.getElementById('unifi-info-user').textContent = settings.unifi_user || 'N/A';
            modal.classList.add('active');
        }
    });
}

function renderNetwork(servers, unifiDevices) {
    const style = getComputedStyle(document.body);
    const accentColor = style.getPropertyValue('--accent-primary').trim() || '#5e6ad2';
    const accentSecondary = style.getPropertyValue('--accent-secondary').trim() || '#00d2ff';

    const nodes = [];
    const edges = [];

    // Add a central "Core Network" node
    nodes.push({
        id: 'core_network',
        label: 'Core Network',
        group: 'network',
        shape: 'hexagon',
        font: { color: 'white', size: 18, face: 'Inter, sans-serif' },
        shadow: true,
        size: 30
    });

    // Add UniFi devices to the graph
    if (unifiDevices) {
        unifiDevices.forEach(dev => {
            nodes.push({
                id: dev.id,
                label: `${dev.name}\n${dev.ip}`,
                title: `UniFi ${dev.model} (${dev.type})`,
                group: 'unifi'
            });
            // Connect UniFi devices to the core network
            edges.push({ from: 'core_network', to: dev.id });
        });
    }

    servers.forEach(server => {
        nodes.push({
            id: server.id,
            label: `${server.name}\n${server.ip}`,
            title: `Host: ${server.ip}`,
            group: 'server'
        });

        // Link servers to the first Gateway found, or to the core network
        const gateway = unifiDevices.find(d => d.type?.toLowerCase().includes('gateway') || d.model?.toLowerCase().includes('udm'));
        if (gateway) {
            edges.push({ from: server.id, to: gateway.id });
        } else {
            edges.push({ from: 'core_network', to: server.id });
        }

        server.services.forEach(svc => {
            nodes.push({
                id: svc.id,
                label: `${svc.name}\n${svc.ip || 'No IP'}`,
                title: `Service: ${svc.ip || 'N/A'}`,
                group: 'service'
            });
            edges.push({ from: server.id, to: svc.id });
        });
    });

    const container = document.getElementById('mynetwork');
    const data = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges)
    };

    const options = {
        nodes: {
            shape: 'dot',
            size: 16,
            font: { size: 12, color: '#ffffff' },
            borderWidth: 2,
            shadow: true
        },
        groups: {
            network: { color: { background: accentColor, border: '#ffffff' }, size: 30 },
            unifi: { color: { background: '#007bff', border: '#ffffff' }, shape: 'diamond', size: 20 },
            server: { color: { background: accentColor, border: accentColor }, size: 20 },
            service: { color: { background: accentSecondary, border: accentSecondary }, size: 12 }
        },
        edges: {
            width: 1.5,
            color: { inherit: 'from', opacity: 0.4 },
            smooth: { type: 'continuous' }
        },
        physics: {
            enabled: true,
            stabilization: { iterations: 100 },
            solver: 'forceAtlas2Based',
            forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 100 }
        }
    };
    new vis.Network(container, data, options);
}

function openManualDeviceModal(dev = null) {
    const form = document.getElementById('form-manual-device');
    form.reset();

    if (dev) {
        document.getElementById('manual-device-modal-title').textContent = "Edit Network Device";
        document.getElementById('manual-device-id').value = dev.id;
        document.getElementById('manual-name').value = dev.name;
        document.getElementById('manual-type').value = dev.type;
        document.getElementById('manual-brand').value = dev.brand || '';
        document.getElementById('manual-model').value = dev.model || '';
        document.getElementById('manual-ip').value = dev.ip || '';
        document.getElementById('manual-serial').value = dev.serial || '';
        document.getElementById('btn-delete-manual-device').style.display = 'block';
    } else {
        document.getElementById('manual-device-modal-title').textContent = "Add Network Device";
        document.getElementById('manual-device-id').value = "";
        document.getElementById('btn-delete-manual-device').style.display = 'none';
    }

    document.getElementById('modal-manual-device').classList.add('active');
}

// Manual Device Events
document.getElementById('btn-add-manual-device')?.addEventListener('click', () => openManualDeviceModal());

document.getElementById('form-manual-device')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('manual-device-id').value;
    const payload = {
        name: document.getElementById('manual-name').value,
        type: document.getElementById('manual-type').value,
        brand: document.getElementById('manual-brand').value,
        model: document.getElementById('manual-model').value,
        ip: document.getElementById('manual-ip').value,
        serial: document.getElementById('manual-serial').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/network-devices/${id}` : '/api/network-devices';

    await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    window.location.reload();
});

document.getElementById('btn-delete-manual-device')?.addEventListener('click', async () => {
    const id = document.getElementById('manual-device-id').value;
    if (id && confirm("Delete this network device?")) {
        await fetch(`/api/network-devices/${id}`, { method: 'DELETE' });
        window.location.reload();
    }
});

// UniFi Integration Logic
document.getElementById('btn-connect-unifi')?.addEventListener('click', () => {
    document.getElementById('modal-unifi-creds').classList.add('active');
});

document.getElementById('form-unifi-creds')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const host = document.getElementById('unifi-host').value.trim();
    const user = document.getElementById('unifi-user').value.trim();
    const password = document.getElementById('unifi-pass').value;

    const btn = document.getElementById('btn-unifi-connect');
    const originalText = btn.textContent;
    btn.textContent = 'Connecting...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/unifi/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, user, password })
        });
        const data = await res.json();

        if (data.success) {
            window.location.reload();
        } else {
            alert(data.error || "Failed to connect to UniFi. Check credentials and ensure local access is enabled.");
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

document.getElementById('btn-unifi-delete')?.addEventListener('click', async () => {
    if (confirm("Disconnect UniFi and remove all cached device data?")) {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unifi_host: '', unifi_user: '', unifi_pass: '' })
        });
        window.location.reload();
    }
});
