let stateServers = [];
let stateRacks = [];
let stateNetworkDevices = [];
let enableRacks = false;
let showNetworkInDashboard = false;
let currentServerId = null;
let currentServiceId = null;
let currentRackId = null;

document.addEventListener('appReady', (e) => {
    stateServers = e.detail.servers;
    stateRacks = e.detail.racks || [];
    stateNetworkDevices = e.detail.network_devices || [];
    enableRacks = e.detail.settings?.enable_racks === 'true';
    showNetworkInDashboard = e.detail.settings?.show_network_in_dashboard === 'true';

    renderApp();
    setupEventListeners();
});

function renderApp() {
    const dash = document.getElementById('dashboard');
    dash.innerHTML = '';

    if (enableRacks) {
        document.getElementById('btn-add-rack').style.display = 'inline-flex';
        document.getElementById('group-add-server-rack').style.display = 'flex';
        document.getElementById('group-edit-server-rack').style.display = 'flex';

        const rackOptions = `<option value="">-- Unassigned --</option>` + stateRacks.map(r => `<option value="${r.id}">${window.escapeHTML(r.name)}</option>`).join('');
        document.getElementById('server-rack').innerHTML = rackOptions;
        document.getElementById('edit-server-rack').innerHTML = rackOptions;

        if (stateServers.length === 0 && stateRacks.length === 0) {
            dash.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">No servers or racks tracked. Add a rack to get started!</div>';
            return;
        }

        const mappedRacks = stateRacks.map(r => ({ ...r, servers: [], network_devices: [] }));
        const unassignedServers = [];
        const unassignedNetwork = [];

        stateServers.forEach(s => {
            if (s.rack_id) {
                const r = mappedRacks.find(mr => mr.id === s.rack_id);
                if (r) r.servers.push(s);
                else unassignedServers.push(s);
            } else {
                unassignedServers.push(s);
            }
        });

        if (showNetworkInDashboard) {
            stateNetworkDevices.forEach(d => {
                if (d.rack_id) {
                    const r = mappedRacks.find(mr => mr.id === d.rack_id);
                    if (r) r.network_devices.push(d);
                    else unassignedNetwork.push(d);
                } else {
                    unassignedNetwork.push(d);
                }
            });
        }

        mappedRacks.forEach(rack => renderRack(rack, dash));

        if (unassignedServers.length > 0 || (showNetworkInDashboard && unassignedNetwork.length > 0)) {
            renderRack({
                id: null,
                name: 'Infrastructure & Network',
                location: 'Unassigned Gear',
                servers: unassignedServers,
                network_devices: unassignedNetwork
            }, dash);
        }
    } else {
        if (stateServers.length === 0) {
            dash.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">No servers tracked. Add one to get started!</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'dashboard-grid';
        stateServers.forEach(server => grid.appendChild(createServerCard(server, false)));
        dash.appendChild(grid);
    }
}

function renderRack(rack, container) {
    const group = document.createElement('div');
    group.className = 'rack-group';

    const header = document.createElement('div');
    header.className = 'rack-header';
    const locHtml = rack.location ? `<span class="rack-location">📍 ${window.escapeHTML(rack.location)}</span>` : '';
    const titleStyles = rack.id ? `class="rack-header-title" data-rack-id="${rack.id}"` : 'style="font-size: 1.5rem; font-weight: 600;"';
    header.innerHTML = `<h2 ${titleStyles}>${window.escapeHTML(rack.name)}</h2>${locHtml}`;
    group.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'rack-grid';
    grid.dataset.rackId = rack.id || '';

    if (enableRacks) {
        grid.addEventListener('dragover', (e) => {
            e.preventDefault();
            grid.classList.add('drag-over');
        });
        grid.addEventListener('dragleave', () => {
            grid.classList.remove('drag-over');
        });
        grid.addEventListener('drop', async (e) => {
            e.preventDefault();
            grid.classList.remove('drag-over');
            const draggedId = e.dataTransfer.getData('text/plain');
            const type = e.dataTransfer.getData('nebula/type');
            if (draggedId) {
                const targetRackId = grid.dataset.rackId === '' ? null : grid.dataset.rackId;

                if (type === 'server') {
                    const server = stateServers.find(s => s.id === draggedId);
                    if (server && server.rack_id !== targetRackId) {
                        await fetch('/api/servers/' + draggedId, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...server, rack_id: targetRackId })
                        });
                        window.location.reload();
                    }
                } else if (type === 'network') {
                    const dev = stateNetworkDevices.find(d => d.id === draggedId);
                    if (dev && dev.rack_id !== targetRackId) {
                        await fetch('/api/network-devices/' + draggedId, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...dev, rack_id: targetRackId })
                        });
                        window.location.reload();
                    }
                }
            }
        });
    }

    rack.servers.forEach(s => {
        grid.appendChild(createServerCard(s, enableRacks));
    });

    if (showNetworkInDashboard && rack.network_devices) {
        rack.network_devices.forEach(d => {
            grid.appendChild(createNetworkDeviceCard(d, enableRacks));
        });
    }

    group.appendChild(grid);
    container.appendChild(group);
}

function createServerCard(server, draggable) {
    const card = document.createElement('div');
    card.className = 'glass-panel server-card';
    card.innerHTML = `
        <div class="server-header">
            <div class="server-title">
                <h2 style="cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='white'; this.style.textDecoration='underline';" onmouseout="this.style.color=''; this.style.textDecoration='none';">
                    ${window.escapeHTML(server.name)}
                </h2>
                <span class="server-ip">${window.escapeHTML(server.ip || 'No IP specified')}</span>
            </div>
        </div>
        ${server.description ? `<p class="server-desc">${window.escapeHTML(server.description)}</p>` : ''}
        
        <div class="services-list" id="services-${server.id}">
            ${server.services.map(svc => `
                <div class="service-item" data-server-id="${server.id}" data-service-id="${svc.id}">
                    <div class="service-info">
                        <span class="service-name">${window.escapeHTML(svc.name)}</span>
                        <div class="service-meta">
                            ${svc.ip ? `<span><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg> ${window.escapeHTML(svc.ip)}</span>` : ''}
                            ${svc.vmid ? `<span><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polygon points="3 6 4 18 20 18 21 6 12 12 3 6"></polygon></svg> VM ${window.escapeHTML(svc.vmid)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
            
            <button class="add-service-btn" data-server-id="${server.id}">+ Add Service / VM</button>
        </div>
    `;

    if (draggable) {
        card.setAttribute('draggable', 'true');
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', server.id);
            e.dataTransfer.setData('nebula/type', 'server');
            card.style.opacity = '0.5';
        });
        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
        });
    }

    return card;
}

function createNetworkDeviceCard(device, draggable) {
    const card = document.createElement('div');
    card.className = 'glass-panel server-card network-card';
    card.style.borderLeft = '4px solid var(--accent-secondary)';

    card.innerHTML = `
        <div class="server-header">
            <div class="server-title">
                <h2 style="cursor: default;">
                    ${window.escapeHTML(device.name)}
                </h2>
                <span class="server-ip">${window.escapeHTML(device.ip || 'No IP')} • ${window.escapeHTML(device.model || device.type)}</span>
            </div>
        </div>
        <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 0.8rem;">
            <span><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg> ${window.escapeHTML(device.type)}</span>
            ${device.brand ? `<span><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> ${window.escapeHTML(device.brand)}</span>` : ''}
        </div>
    `;

    if (draggable) {
        card.setAttribute('draggable', 'true');
        card.style.cursor = 'grab';
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', device.id);
            e.dataTransfer.setData('nebula/type', 'network');
            card.style.opacity = '0.5';
        });
        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
        });
    }

    return card;
}

function setupEventListeners() {
    const modalAddServer = document.getElementById('modal-add-server');
    const modalAddService = document.getElementById('modal-add-service');
    const modalViewService = document.getElementById('modal-view-service');

    document.getElementById('btn-add-server').addEventListener('click', () => {
        modalAddServer.classList.add('active');
    });

    document.getElementById('form-add-server').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('server-name').value.trim(),
            ip: document.getElementById('server-ip').value.trim(),
            description: document.getElementById('server-description').value.trim(),
            rack_id: enableRacks ? document.getElementById('server-rack').value : null
        };
        await fetch('/api/servers', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        window.location.reload();
    });

    document.getElementById('form-add-service').addEventListener('submit', async (e) => {
        e.preventDefault();
        const svcId = document.getElementById('service-id').value;
        const payload = {
            server_id: document.getElementById('service-server-id').value,
            name: document.getElementById('service-name').value.trim(),
            vmid: document.getElementById('service-vmid').value,
            ip: document.getElementById('service-ip').value.trim(),
            vlan: document.getElementById('service-vlan').value,
            cpu: document.getElementById('service-cpu').value,
            ram: document.getElementById('service-ram').value,
            storage: document.getElementById('service-storage').value,
            description: document.getElementById('service-desc').value.trim()
        };

        const method = svcId ? 'PUT' : 'POST';
        const url = svcId ? `/api/services/${svcId}` : '/api/services';

        await fetch(url, {
            method: method, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        window.location.reload();
    });

    document.getElementById('dashboard').addEventListener('click', (e) => {
        const addSvcBtn = e.target.closest('.add-service-btn');
        if (addSvcBtn) {
            document.getElementById('form-add-service').reset();
            document.getElementById('service-server-id').value = addSvcBtn.dataset.serverId;
            document.getElementById('service-id').value = "";
            document.getElementById('modal-add-service-title').textContent = "Add Service / VM";
            document.getElementById('btn-delete-service').style.display = 'none';
            modalAddService.classList.add('active');
            return;
        }

        const serverTitle = e.target.closest('h2');
        if (serverTitle && !serverTitle.classList.contains('rack-header-title')) {
            const serverCard = serverTitle.closest('.server-card');
            if (serverCard) {
                // Find server by looking at any child button data
                const anyNodeWithId = serverCard.querySelector('[data-server-id]');
                const sId = anyNodeWithId ? anyNodeWithId.dataset.serverId : null;
                const server = stateServers.find(s => s.id === sId);
                if (server) {
                    currentServerId = server.id;
                    document.getElementById('edit-server-id').value = server.id;
                    document.getElementById('edit-server-name').value = server.name;
                    document.getElementById('edit-server-ip').value = server.ip || '';
                    document.getElementById('edit-server-description').value = server.description || '';
                    document.getElementById('edit-server-rack').value = server.rack_id || '';
                    document.getElementById('modal-edit-server').classList.add('active');
                    return;
                }
            }
        }

        const rackTitle = e.target.closest('.rack-header-title');
        if (rackTitle) {
            const rack = stateRacks.find(r => r.id === rackTitle.dataset.rackId);
            if (rack) {
                currentRackId = rack.id;
                document.getElementById('edit-rack-id').value = rack.id;
                document.getElementById('edit-rack-name').value = rack.name;
                document.getElementById('edit-rack-location').value = rack.location || '';
                document.getElementById('modal-edit-rack').classList.add('active');
                return;
            }
        }

        const svcItem = e.target.closest('.service-item');
        if (svcItem) {
            const server = stateServers.find(s => s.id === svcItem.dataset.serverId);
            const svc = server.services.find(s => s.id === svcItem.dataset.serviceId);
            currentServerId = server.id;
            currentServiceId = svc.id;

            // Pre-fill "Add/Edit Service" modal instead of just viewing
            document.getElementById('modal-add-service-title').textContent = "Manage Service / VM";
            document.getElementById('service-id').value = svc.id;
            document.getElementById('service-server-id').value = server.id;
            document.getElementById('service-name').value = svc.name;
            document.getElementById('service-vmid').value = svc.vmid || '';
            document.getElementById('service-ip').value = svc.ip || '';
            document.getElementById('service-vlan').value = svc.vlan || '';
            document.getElementById('service-cpu').value = svc.cpu || '';
            document.getElementById('service-ram').value = svc.ram || '';
            document.getElementById('service-storage').value = svc.storage || '';
            document.getElementById('service-desc').value = svc.description || '';

            document.getElementById('btn-delete-service').style.display = 'block';
            modalAddService.classList.add('active');
        }
    });

    document.getElementById('btn-delete-service').addEventListener('click', async () => {
        if (currentServiceId) {
            await fetch(`/api/services/${currentServiceId}`, { method: 'DELETE' });
            window.location.reload();
        }
    });

    document.getElementById('form-edit-server')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('edit-server-name').value.trim(),
            ip: document.getElementById('edit-server-ip').value.trim(),
            description: document.getElementById('edit-server-description').value.trim(),
            rack_id: enableRacks ? document.getElementById('edit-server-rack').value : null
        };
        await fetch(`/api/servers/${currentServerId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        window.location.reload();
    });

    document.getElementById('btn-add-rack')?.addEventListener('click', () => {
        document.getElementById('form-add-rack').reset();
        document.getElementById('modal-add-rack').classList.add('active');
    });

    document.getElementById('form-add-rack')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('rack-name').value.trim(),
            location: document.getElementById('rack-location').value.trim()
        };
        await fetch('/api/racks', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        window.location.reload();
    });

    document.getElementById('form-edit-rack')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('edit-rack-name').value.trim(),
            location: document.getElementById('edit-rack-location').value.trim()
        };
        await fetch(`/api/racks/${currentRackId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        window.location.reload();
    });

    document.getElementById('btn-delete-rack')?.addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete this rack and ALL servers and services inside it? This cannot be undone.")) {
            if (currentRackId) {
                await fetch(`/api/racks/${currentRackId}`, { method: 'DELETE' });
                window.location.reload();
            }
        }
    });

    document.getElementById('btn-delete-server')?.addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete this physical server and ALL of its associated VMs and Services? This cannot be undone.")) {
            if (currentServerId) {
                await fetch(`/api/servers/${currentServerId}`, { method: 'DELETE' });
                window.location.reload();
            }
        }
    });

    let proxmoxTargetHost = null;

    document.getElementById('btn-pull-proxmox')?.addEventListener('click', () => {
        const serverId = document.getElementById('service-server-id').value;
        const server = stateServers.find(s => s.id === serverId);
        if (!server || !server.ip) {
            alert("This server does not have an IP address configured. Proxmox connection requires an IP.");
            return;
        }

        proxmoxTargetHost = server.ip + ':8006';

        // Hide the current add-service modal (optional, or keep it open in background)
        // Let's just stack them, z-index should handle it.
        document.getElementById('modal-proxmox-creds').classList.add('active');
    });

    document.getElementById('form-proxmox-creds')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('proxmox-user').value.trim();
        const password = document.getElementById('proxmox-pass').value;

        const connectBtn = document.getElementById('btn-proxmox-connect');
        const defaultText = connectBtn.innerHTML;

        try {
            connectBtn.innerHTML = 'Connecting...';
            connectBtn.disabled = true;

            const res = await fetch('/api/proxmox/vms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host: proxmoxTargetHost, user, password })
            });
            const data = await res.json();

            if (data.success && data.vms.length > 0) {
                document.getElementById('modal-proxmox-creds').classList.remove('active');

                // Populate VM list
                const list = document.getElementById('proxmox-vm-list');
                list.innerHTML = '';

                data.vms.forEach(vm => {
                    const card = document.createElement('div');
                    card.className = 'glass-panel detail-item';
                    card.style.cursor = 'pointer';
                    card.style.transition = 'var(--transition-fast)';
                    card.onmouseover = () => card.style.background = 'rgba(255,255,255,0.1)';
                    card.onmouseout = () => card.style.background = 'rgba(0,0,0,0.2)';

                    card.innerHTML = `
                        <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--accent-secondary)">${window.escapeHTML(vm.name || 'Unnamed VM')}</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
                            <div><strong>ID:</strong> ${vm.vmid}</div>
                            <div><strong>Type:</strong> ${vm.type.toUpperCase()}</div>
                            <div><strong>CPU:</strong> ${vm.cpu}</div>
                            <div><strong>RAM:</strong> ${vm.ram} GB</div>
                        </div>
                    `;

                    card.addEventListener('click', () => {
                        document.getElementById('service-name').value = vm.name || '';
                        document.getElementById('service-vmid').value = vm.vmid || '';
                        document.getElementById('service-cpu').value = vm.cpu || '';
                        document.getElementById('service-ram').value = vm.ram || '';
                        document.getElementById('service-storage').value = vm.storage || '';

                        document.getElementById('modal-proxmox-vms').classList.remove('active');
                    });

                    list.appendChild(card);
                });

                document.getElementById('modal-proxmox-vms').classList.add('active');
            } else {
                alert(data.error || "No VMs found or connection failed. Please check credentials.");
            }
        } catch (e) {
            alert("Error communicating with backend: " + e.message);
        } finally {
            connectBtn.innerHTML = defaultText;
            connectBtn.disabled = false;
        }
    });
}
