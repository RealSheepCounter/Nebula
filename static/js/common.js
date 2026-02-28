function applyPalette(palette) {
    document.body.className = `palette-${palette}`;
    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.palette-btn.${palette}`)?.classList.add('active');
}

async function fetchState() {
    try {
        const res = await fetch('/api/data');
        return await res.json();
    } catch (e) {
        console.error("Failed to fetch state API");
        return { servers: [], settings: { palette: 'blue' } };
    }
}

async function savePalette(palette) {
    applyPalette(palette);
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palette })
    });
}

// --- CONFIGURATION ---
const GITHUB_REPO_URL = "https://github.com"; // Change this to your repo link!

function injectModals() {
    const html = `
    <!-- Settings Modal -->
    <div class="modal-overlay" id="modal-settings">
        <div class="glass-panel modal-content">
            <div class="modal-header">
                <h2>Settings</h2>
                <button class="icon-button close-modal">&times;</button>
            </div>
            <div class="form-group">
                <label>Theme Palette</label>
                <div class="palette-options" style="display: flex; gap: 1rem; margin-top:0.5rem; flex-wrap: wrap;">
                    <button class="glass-button secondary palette-btn blue" data-palette="blue">Ocean Blue</button>
                    <button class="glass-button secondary palette-btn purple" data-palette="purple">Deep Purple</button>
                    <button class="glass-button secondary palette-btn red" data-palette="red">Crimson Red</button>
                    <button class="glass-button secondary palette-btn green" data-palette="green">Forest Green</button>
                    <button class="glass-button secondary palette-btn orange" data-palette="orange">Sunset Orange</button>
                </div>
            </div>
            <div class="form-group" style="margin-top: 1.5rem;">
                <label>Features</label>
                <div style="display:flex; align-items:center; justify-content:space-between; background: rgba(255,255,255,0.03); padding: 0.8rem; border-radius: 12px; margin-top: 0.5rem;">
                    <span style="color:var(--text-main); font-size: 0.95rem;">Equipment Racks Layout</span>
                    <label class="switch">
                        <input type="checkbox" id="toggle-racks">
                        <span class="slider"></span>
                    </label>
                </div>
                <div id="settings-network-group" style="display:none; align-items:center; justify-content:space-between; background: rgba(255,255,255,0.03); padding: 0.8rem; border-radius: 12px; margin-top: 0.5rem;">
                    <span style="color:var(--text-main); font-size: 0.95rem;">Show Network Equipment</span>
                    <label class="switch">
                        <input type="checkbox" id="toggle-show-network">
                        <span class="slider"></span>
                    </label>
                </div>
            </div>

            <!-- GitHub & Credits -->
            <div style="margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem;">
                <a href="${GITHUB_REPO_URL}" target="_blank" class="glass-button secondary" style="width: 100%; justify-content: center; gap: 0.6rem; margin-bottom: 1rem;">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    GitHub Project
                </a>
                <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; letter-spacing: 0.5px;">
                    MADE BY <span style="color: var(--accent-primary); font-weight: 600;">REALSHEEPCOUNTER</span>
                </div>
            </div>
            <div class="form-group" style="margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem;">
                <label style="color: var(--danger)">Danger Zone</label>
                <button id="btn-reset-servers-trigger" class="glass-button" style="background: rgba(255,75,75,0.1); color: var(--danger); border: 1px solid var(--danger); margin-top:0.5rem;">Reset All Servers & Data</button>
            </div>
        </div>
    </div>

    <!-- Confirm Reset Modal -->
    <div class="modal-overlay" id="modal-confirm-reset">
        <div class="glass-panel modal-content">
            <div class="modal-header">
                <h2>Confirm Reset</h2>
                <button class="icon-button close-modal">&times;</button>
            </div>
            <p style="color:#b3c0cf;">Are you absolutely sure you want to delete all servers and services? This action cannot be undone.</p>
            <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
                <button class="glass-button secondary cancel-modal">Cancel</button>
                <button id="btn-confirm-reset" class="glass-button" style="background: var(--danger);">Yes, Delete Everything</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function setupCommonUI() {
    injectModals();

    document.getElementById('btn-settings')?.addEventListener('click', () => {
        document.getElementById('modal-settings').classList.add('active');
    });

    document.querySelectorAll('.palette-btn').forEach(btn => {
        btn.addEventListener('click', (e) => savePalette(e.target.dataset.palette));
    });

    const toggleRacks = document.getElementById('toggle-racks');
    if (toggleRacks) {
        toggleRacks.addEventListener('change', async (e) => {
            const val = e.target.checked ? 'true' : 'false';
            localStorage.setItem('reopenSettings', 'true');

            const dash = document.getElementById('dashboard');
            if (dash) dash.style.opacity = '0.5';

            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enable_racks: val })
            });
            window.location.reload();
        });
    }

    const toggleShowNet = document.getElementById('toggle-show-network');
    if (toggleShowNet) {
        toggleShowNet.addEventListener('change', async (e) => {
            const val = e.target.checked ? 'true' : 'false';
            localStorage.setItem('reopenSettings', 'true');

            const dash = document.getElementById('dashboard');
            if (dash) dash.style.opacity = '0.5';

            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ show_network_in_dashboard: val })
            });
            window.location.reload();
        });
    }

    document.getElementById('btn-reset-servers-trigger')?.addEventListener('click', () => {
        document.getElementById('modal-settings').classList.remove('active');
        document.getElementById('modal-confirm-reset').classList.add('active');
    });

    document.getElementById('btn-confirm-reset')?.addEventListener('click', async () => {
        await fetch('/api/servers', { method: 'DELETE' });
        window.location.reload();
    });

    // Delegated close listener
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-modal') || e.target.closest('.close-modal') || e.target.classList.contains('cancel-modal')) {
            e.target.closest('.modal-overlay').classList.remove('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    setupCommonUI();
    const state = await fetchState();

    // Apply Settings
    applyPalette(state.settings.palette || 'blue');

    if (state.settings.enable_racks === 'true') {
        const tr = document.getElementById('toggle-racks');
        if (tr) tr.checked = true;
        const sng = document.getElementById('settings-network-group');
        if (sng) sng.style.display = 'flex';
    }

    if (state.settings.show_network_in_dashboard === 'true') {
        const tsn = document.getElementById('toggle-show-network');
        if (tsn) tsn.checked = true;
    }

    if (localStorage.getItem('reopenSettings') === 'true') {
        localStorage.removeItem('reopenSettings');
        document.getElementById('modal-settings')?.classList.add('active');
    }

    // Announce to specialized scripts
    const event = new CustomEvent('appReady', { detail: state });
    document.dispatchEvent(event);
});

window.escapeHTML = function (str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};
