import os
import sqlite3
import uuid
from flask import Flask, jsonify, request, send_from_directory, Response
from proxmoxer import ProxmoxAPI
import urllib3
import csv
import io
import requests
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__, static_folder='static')
DB_FILE = os.environ.get('DB_FILE', 'data.db')

def get_db():
    conn = sqlite3.connect(DB_FILE, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

def seed_demo_data(c):
    # Insert fictional demo server
    c.execute("INSERT INTO servers (id, rack_id, name, ip, description) VALUES (?,?,?,?,?)",
              ('srv_demo', None, 'Nebula-Core-01', '10.0.0.10', 'Demo Server - A fictional core server for demonstration.'))
    
    # Insert fictional demo network device
    c.execute("""INSERT INTO network_devices (id, rack_id, name, ip, model, type, brand, serial, is_manual) 
                 VALUES (?,?,?,?,?,?,?,?,?)""",
              ('net_demo', None, 'Aether-Gateway-X1', '10.0.0.1', 'A-1000', 'router', 'Aether Industries', 'SN-0001-DEMO', 1))

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS racks (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    location TEXT
                )''')
    c.execute('''CREATE TABLE IF NOT EXISTS servers (
                    id TEXT PRIMARY KEY,
                    rack_id TEXT,
                    name TEXT,
                    ip TEXT,
                    description TEXT,
                    FOREIGN KEY(rack_id) REFERENCES racks(id) ON DELETE SET NULL
                )''')
    
    # Simple migration if missing rack_id
    try:
        c.execute("ALTER TABLE servers ADD COLUMN rack_id TEXT")
    except sqlite3.OperationalError:
        pass
    c.execute('''CREATE TABLE IF NOT EXISTS services (
                    id TEXT PRIMARY KEY,
                    server_id TEXT,
                    name TEXT,
                    vmid INTEGER,
                    ip TEXT,
                    vlan INTEGER,
                    cpu INTEGER,
                    ram REAL,
                    storage INTEGER,
                    description TEXT,
                    FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
                )''')
    c.execute('''CREATE TABLE IF NOT EXISTS network_devices (
                    id TEXT PRIMARY KEY,
                    rack_id TEXT,
                    name TEXT,
                    ip TEXT,
                    model TEXT,
                    type TEXT,
                    brand TEXT,
                    serial TEXT,
                    is_manual INTEGER DEFAULT 0,
                    FOREIGN KEY(rack_id) REFERENCES racks(id) ON DELETE SET NULL
                )''')
    # Use network_devices instead of unifi_devices
    try:
        c.execute("INSERT INTO network_devices (id, name, ip, model, type) SELECT id, name, ip, model, type FROM unifi_devices")
        c.execute("DROP TABLE unifi_devices")
    except sqlite3.OperationalError:
        pass
    c.execute('''CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )''')
    c.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('palette', 'blue')")
    
    # Insert seed data only if empty
    c.execute("SELECT count(*) FROM servers")
    if c.fetchone()[0] == 0:
        c.execute("SELECT count(*) FROM settings WHERE key='user_cleared'")
        if c.fetchone()[0] == 0:
            seed_demo_data(c)
            
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/network')
def network():
    return send_from_directory('static', 'network.html')

@app.route('/css/<path:path>')
def send_css(path):
    return send_from_directory('static/css', path)

@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('static/js', path)

@app.route('/api/data', methods=['GET'])
def get_data():
    conn = get_db()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM servers")
        servers = [dict(row) for row in c.fetchall()]
        
        c.execute("SELECT * FROM services")
        services = [dict(row) for row in c.fetchall()]
        
        c.execute("SELECT * FROM settings")
        settings = {row['key']: row['value'] for row in c.fetchall()}
        
        c.execute("SELECT * FROM racks")
        racks = [dict(row) for row in c.fetchall()]
        
        c.execute("SELECT * FROM network_devices")
        network_devices = [dict(row) for row in c.fetchall()]
    finally:
        conn.close()
    
    servers_dict = {s['id']: {**s, 'services': []} for s in servers}
    for svc in services:
        if svc['server_id'] in servers_dict:
            servers_dict[svc['server_id']]['services'].append(svc)
            
    return jsonify({
        'racks': racks,
        'servers': list(servers_dict.values()),
        'settings': settings,
        'network_devices': network_devices
    })

@app.route('/api/racks', methods=['POST'])
def add_rack():
    data = request.json
    u_hex = uuid.uuid4().hex
    id_val = f"rck_{u_hex[:8]}"
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO racks (id, name, location) VALUES (?,?,?)", (id_val, data['name'], data.get('location', '')))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/racks/<rack_id>', methods=['PUT', 'DELETE'])
def manage_rack(rack_id):
    conn = get_db()
    c = conn.cursor()
    if request.method == 'DELETE':
        # Removing a rack unassigns servers (ON DELETE SET NULL), or we can cascade. User says "delete them and their servers"
        c.execute("DELETE FROM services WHERE server_id IN (SELECT id FROM servers WHERE rack_id=?)", (rack_id,))
        c.execute("DELETE FROM servers WHERE rack_id=?", (rack_id,))
        c.execute("DELETE FROM racks WHERE id=?", (rack_id,))
    else:
        data = request.json
        c.execute("UPDATE racks SET name=?, location=? WHERE id=?", (data['name'], data.get('location', ''), rack_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/servers', methods=['POST'])
def add_server():
    data = request.json
    u_hex = uuid.uuid4().hex
    id_val = f"srv_{u_hex[:8]}"
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO servers (id, rack_id, name, ip, description) VALUES (?,?,?,?,?)",
              (id_val, data.get('rack_id'), data['name'], data.get('ip', ''), data.get('description', '')))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/services', methods=['POST'])
def add_service():
    data = request.json
    u_hex = uuid.uuid4().hex
    id_val = f"svc_{u_hex[:8]}"
    conn = get_db()
    c = conn.cursor()
    c.execute("""INSERT INTO services 
                 (id, server_id, name, vmid, ip, vlan, cpu, ram, storage, description) 
                 VALUES (?,?,?,?,?,?,?,?,?,?)""",
              (id_val, data['server_id'], data['name'], data.get('vmid'), data.get('ip'), 
               data.get('vlan'), data.get('cpu'), data.get('ram'), data.get('storage'), data.get('description')))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/services/<svc_id>', methods=['PUT', 'DELETE'])
def manage_service(svc_id):
    conn = get_db()
    c = conn.cursor()
    if request.method == 'DELETE':
        c.execute("DELETE FROM services WHERE id=?", (svc_id,))
    else:
        data = request.json
        c.execute("""UPDATE services SET name=?, vmid=?, ip=?, vlan=?, cpu=?, ram=?, storage=?, description=? 
                     WHERE id=?""",
                  (data['name'], data.get('vmid'), data.get('ip'), data.get('vlan'), 
                   data.get('cpu'), data.get('ram'), data.get('storage'), data.get('description'), svc_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/servers/<srv_id>', methods=['PUT', 'DELETE'])
def manage_server(srv_id):
    conn = get_db()
    c = conn.cursor()
    if request.method == 'DELETE':
        c.execute("DELETE FROM servers WHERE id=?", (srv_id,))
    else:
        data = request.json
        c.execute("UPDATE servers SET rack_id=?, name=?, ip=?, description=? WHERE id=?", 
                  (data.get('rack_id'), data['name'], data.get('ip', ''), data.get('description', ''), srv_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/servers', methods=['DELETE'])
def reset_servers():
    conn = get_db()
    try:
        c = conn.cursor()
        c.execute("DELETE FROM services")
        c.execute("DELETE FROM servers")
        c.execute("DELETE FROM racks")
        c.execute("DELETE FROM network_devices")
        # seed with demo items as per user request
        seed_demo_data(c)
        c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('user_cleared', '1')")
        conn.commit()
    finally:
        conn.close()
    return jsonify({'success': True})

@app.route('/api/settings', methods=['POST'])
def update_settings():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    for k, v in data.items():
        c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", (k, str(v)))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/proxmox/vms', methods=['POST'])
def proxmox_vms():
    data = request.json
    try:
        proxmox = ProxmoxAPI(data['host'], user=data['user'], password=data['password'], verify_ssl=False)
        vms = []
        for node in proxmox.nodes.get():
            node_name = node['node']
            for qemu in proxmox.nodes(node_name).qemu.get():
                vms.append({
                    'vmid': qemu.get('vmid'),
                    'name': qemu.get('name', ''),
                    'cpu': qemu.get('cpus', 1),
                    'ram': round(qemu.get('maxmem', 0) / (1024**3), 2),
                    'storage': round(qemu.get('maxdisk', 0) / (1024**3), 2),
                    'type': 'qemu'
                })
            for lxc in proxmox.nodes(node_name).lxc.get():
                vms.append({
                    'vmid': lxc.get('vmid'),
                    'name': lxc.get('name', ''),
                    'cpu': lxc.get('cpus', 1),
                    'ram': round(lxc.get('maxmem', 0) / (1024**3), 2),
                    'storage': round(lxc.get('maxdisk', 0) / (1024**3), 2),
                    'type': 'lxc'
                })
        return jsonify({'success': True, 'vms': vms})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT s.name AS server_name, s.ip AS server_ip, sv.* FROM services sv JOIN servers s ON sv.server_id = s.id")
    rows = c.fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Server Name', 'Server IP', 'Service Name', 'VM ID', 'Service IP', 'VLAN', 'CPU', 'RAM (GB)', 'Storage (GB)', 'Description'])
    for row in rows:
        writer.writerow([
            row['server_name'], row['server_ip'], row['name'], row['vmid'], 
            row['ip'], row['vlan'], row['cpu'], row['ram'], row['storage'], row['description']
        ])
    
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=nebula_inventory.csv"}
    )

@app.route('/api/network-devices', methods=['POST'])
def add_network_device():
    data = request.json
    id_val = f"net_{uuid.uuid4().hex[:8]}"
    conn = get_db()
    c = conn.cursor()
    c.execute("""INSERT INTO network_devices 
                 (id, rack_id, name, ip, model, type, brand, serial, is_manual) 
                 VALUES (?,?,?,?,?,?,?,?,1)""",
              (id_val, data.get('rack_id'), data['name'], data.get('ip'), 
               data.get('model'), data.get('type'), data.get('brand'), data.get('serial')))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/network-devices/<dev_id>', methods=['PUT', 'DELETE'])
def manage_network_device(dev_id):
    conn = get_db()
    c = conn.cursor()
    if request.method == 'DELETE':
        c.execute("DELETE FROM network_devices WHERE id=?", (dev_id,))
    else:
        data = request.json
        c.execute("""UPDATE network_devices SET rack_id=?, name=?, ip=?, model=?, type=?, brand=?, serial=? 
                     WHERE id=?""",
                  (data.get('rack_id'), data['name'], data.get('ip'), data.get('model'), 
                   data.get('type'), data.get('brand'), data.get('serial'), dev_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/unifi/pull', methods=['POST'])
def unifi_pull():
    data = request.json
    host = data['host']
    user = data['user']
    password = data['password']
    
    session = requests.Session()
    session.verify = False
    
    try:
        url = f"https://{host}/api/auth/login"
        r = session.post(url, json={'username': user, 'password': password})
        
        if r.status_code != 200:
            url = f"https://{host}/api/login"
            r = session.post(url, json={'username': user, 'password': password})
            if r.status_code != 200:
                return jsonify({'success': False, 'error': 'Authentication failed for UniFi Controller.'})
            dev_url = f"https://{host}/api/s/default/stat/device"
            fw_url = f"https://{host}/api/s/default/rest/firewallrule"
        else:
            dev_url = f"https://{host}/proxy/network/api/s/default/stat/device"
            fw_url = f"https://{host}/proxy/network/api/s/default/rest/firewallrule"
            
        dev_req = session.get(dev_url)
        # firewall rules ditched as per user request
        
        devices = []
        if dev_req.status_code == 200:
            conn = get_db()
            c = conn.cursor()
            # Clear old non-manual unifi devices on sync
            c.execute("DELETE FROM network_devices WHERE is_manual=0")
            
            for d in dev_req.json().get('data', []):
                dev_obj = {
                    'id': d.get('_id') or str(uuid.uuid4()),
                    'name': d.get('name') or d.get('model', 'Unknown Device'),
                    'ip': d.get('ip', 'N/A'),
                    'model': d.get('model', 'UniFi Device'),
                    'type': (d.get('type') or 'UniFi Device').capitalize(),
                    'is_manual': 0
                }
                devices.append(dev_obj)
                c.execute("INSERT INTO network_devices (id, name, ip, model, type, is_manual) VALUES (?,?,?,?,?,?)",
                          (dev_obj['id'], dev_obj['name'], dev_obj['ip'], dev_obj['model'], dev_obj['type'], 0))
            
            # Store credentials for persistence
            c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", ('unifi_host', host))
            c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", ('unifi_user', user))
            # Note: Storing password in settings for easy re-auth. In production, use secrets.
            c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", ('unifi_pass', password))
            
            conn.commit()
            conn.close()
                
        return jsonify({'success': True, 'devices': devices})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    sqlite3.enable_callback_tracebacks(True)
    init_db()
    app.run(host='0.0.0.0', port=80)
