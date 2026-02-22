// ============================================================
// NEXUS ENGINE - Fully Local & Standalone
// All logic: tools, sessions, workflows, AI — zero backend
// ============================================================

import { v4 as uuidv4 } from 'uuid';

// ---------- PERSISTENCE ----------
const DB_KEY = 'nexus_db';

function loadDB() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || { sessions: {}, messages: {}, executions: {} };
  } catch { return { sessions: {}, messages: {}, executions: {} }; }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// ---------- SESSION MANAGEMENT ----------
export function getSessions() {
  const db = loadDB();
  return Object.values(db.sessions).sort((a, b) => b.updated_at - a.updated_at);
}

export function createSession(name = 'New Session') {
  const db = loadDB();
  const session = { id: uuidv4(), name, created_at: Date.now(), updated_at: Date.now(), message_count: 0 };
  db.sessions[session.id] = session;
  db.messages[session.id] = [];
  saveDB(db);
  return session;
}

export function deleteSession(sessionId) {
  const db = loadDB();
  delete db.sessions[sessionId];
  delete db.messages[sessionId];
  saveDB(db);
}

export function getMessages(sessionId) {
  const db = loadDB();
  return db.messages[sessionId] || [];
}

export function addMessage(sessionId, role, content, extra = {}) {
  const db = loadDB();
  if (!db.messages[sessionId]) db.messages[sessionId] = [];
  const msg = { id: uuidv4(), role, content, timestamp: Date.now(), ...extra };
  db.messages[sessionId].push(msg);
  if (db.sessions[sessionId]) {
    db.sessions[sessionId].message_count = db.messages[sessionId].length;
    db.sessions[sessionId].updated_at = Date.now();
  }
  saveDB(db);
  return msg;
}

// ---------- KALI TOOLS ----------
export const KALI_TOOLS = {
  network: [
    { id: 'nmap', name: 'Nmap', description: 'Network exploration and security auditing' },
    { id: 'netcat', name: 'Netcat', description: 'TCP/UDP connections and network debugging' },
    { id: 'masscan', name: 'Masscan', description: 'Fast port scanner' },
    { id: 'hping3', name: 'Hping3', description: 'Network packet generator and analyzer' },
    { id: 'arp-scan', name: 'ARP-scan', description: 'ARP scanning and fingerprinting' },
    { id: 'tcpdump', name: 'TCPdump', description: 'Network packet analyzer' },
    { id: 'wireshark', name: 'Wireshark', description: 'Network protocol analyzer' },
    { id: 'ettercap', name: 'Ettercap', description: 'MITM attack suite' },
    { id: 'responder', name: 'Responder', description: 'LLMNR/NBT-NS/MDNS poisoner' },
  ],
  web: [
    { id: 'nikto', name: 'Nikto', description: 'Web server scanner' },
    { id: 'dirb', name: 'Dirb', description: 'Web content scanner / directory brute forcer' },
    { id: 'sqlmap', name: 'SQLmap', description: 'Automatic SQL injection tool' },
    { id: 'gobuster', name: 'Gobuster', description: 'Directory/file & DNS busting tool' },
    { id: 'wpscan', name: 'WPScan', description: 'WordPress vulnerability scanner' },
    { id: 'burpsuite', name: 'Burp Suite', description: 'Web application security testing' },
    { id: 'ffuf', name: 'FFUF', description: 'Fast web fuzzer' },
    { id: 'whatweb', name: 'WhatWeb', description: 'Web scanner and fingerprinter' },
    { id: 'xsstrike', name: 'XSStrike', description: 'XSS detection suite' },
    { id: 'commix', name: 'Commix', description: 'Command injection exploiter' },
  ],
  password: [
    { id: 'hydra', name: 'Hydra', description: 'Fast network logon cracker' },
    { id: 'john', name: 'John the Ripper', description: 'Password cracker' },
    { id: 'hashcat', name: 'Hashcat', description: 'Advanced password recovery' },
    { id: 'medusa', name: 'Medusa', description: 'Parallel password cracker' },
    { id: 'cewl', name: 'CeWL', description: 'Custom word list generator' },
    { id: 'crunch', name: 'Crunch', description: 'Wordlist generator' },
    { id: 'ophcrack', name: 'Ophcrack', description: 'Windows password cracker' },
    { id: 'mimikatz', name: 'Mimikatz', description: 'Windows credential extractor' },
  ],
  exploitation: [
    { id: 'metasploit', name: 'Metasploit', description: 'Penetration testing framework' },
    { id: 'searchsploit', name: 'SearchSploit', description: 'Exploit database search' },
    { id: 'msfvenom', name: 'MSFvenom', description: 'Payload generator' },
    { id: 'beef', name: 'BeEF', description: 'Browser exploitation framework' },
    { id: 'empire', name: 'Empire', description: 'Post-exploitation framework' },
    { id: 'cobalt-strike', name: 'Cobalt Strike', description: 'Adversary simulation' },
    { id: 'covenant', name: 'Covenant', description: 'C2 framework' },
  ],
  wireless: [
    { id: 'aircrack-ng', name: 'Aircrack-ng', description: 'WiFi security auditing' },
    { id: 'reaver', name: 'Reaver', description: 'WPS brute force attack' },
    { id: 'wifite', name: 'Wifite', description: 'Automated wireless auditor' },
    { id: 'kismet', name: 'Kismet', description: 'Wireless network detector' },
    { id: 'fern', name: 'Fern WiFi Cracker', description: 'Wireless security auditor' },
    { id: 'bettercap', name: 'Bettercap', description: 'Network attack framework' },
  ],
  recon: [
    { id: 'whois', name: 'Whois', description: 'Domain lookup' },
    { id: 'theHarvester', name: 'theHarvester', description: 'OSINT gathering' },
    { id: 'maltego', name: 'Maltego', description: 'OSINT and forensics' },
    { id: 'recon-ng', name: 'Recon-ng', description: 'Web reconnaissance framework' },
    { id: 'shodan', name: 'Shodan', description: 'Internet-connected device search' },
    { id: 'dnsrecon', name: 'DNSrecon', description: 'DNS enumeration and zone transfer' },
    { id: 'subfinder', name: 'Subfinder', description: 'Subdomain discovery tool' },
    { id: 'amass', name: 'Amass', description: 'Attack surface mapping' },
    { id: 'spiderfoot', name: 'SpiderFoot', description: 'OSINT automation' },
    { id: 'censys', name: 'Censys', description: 'Internet asset discovery' },
  ],
  forensics: [
    { id: 'volatility', name: 'Volatility', description: 'Memory forensics framework' },
    { id: 'autopsy', name: 'Autopsy', description: 'Digital forensics platform' },
    { id: 'binwalk', name: 'Binwalk', description: 'Firmware analysis tool' },
    { id: 'foremost', name: 'Foremost', description: 'File carving tool' },
    { id: 'exiftool', name: 'ExifTool', description: 'Metadata extraction' },
    { id: 'sleuthkit', name: 'Sleuth Kit', description: 'Filesystem forensics' },
    { id: 'bulk-extractor', name: 'Bulk Extractor', description: 'Digital evidence extraction' },
  ],
  social: [
    { id: 'setoolkit', name: 'SET', description: 'Social Engineering Toolkit' },
    { id: 'gophish', name: 'GoPhish', description: 'Phishing framework' },
    { id: 'king-phisher', name: 'King Phisher', description: 'Phishing campaign toolkit' },
    { id: 'evilginx', name: 'Evilginx2', description: 'MITM phishing framework' },
  ],
  exfiltration: [
    { id: 'dnscat2', name: 'DNScat2', description: 'DNS tunneling for C2 and exfil' },
    { id: 'iodine', name: 'Iodine', description: 'DNS tunnel' },
    { id: 'ptunnel', name: 'Ptunnel', description: 'ICMP tunneling' },
    { id: 'chisel', name: 'Chisel', description: 'TCP/UDP tunnel over HTTP' },
    { id: 'proxychains', name: 'Proxychains', description: 'Proxy chain redirector' },
    { id: 'socat', name: 'Socat', description: 'Multipurpose relay tool' },
    { id: 'stunnel', name: 'Stunnel', description: 'SSL tunneling proxy' },
    { id: 'cloakify', name: 'Cloakify', description: 'Data exfil via text steganography' },
    { id: 'dnsexfil', name: 'DNSExfiltrator', description: 'DNS exfiltration tool' },
    { id: 'icmpsh', name: 'ICMPsh', description: 'ICMP reverse shell' },
  ],
  postexploit: [
    { id: 'bloodhound', name: 'BloodHound', description: 'AD attack path mapping' },
    { id: 'sharphound', name: 'SharpHound', description: 'BloodHound data collector' },
    { id: 'powersploit', name: 'PowerSploit', description: 'PowerShell post-exploitation' },
    { id: 'lazagne', name: 'LaZagne', description: 'Credential recovery tool' },
    { id: 'linpeas', name: 'LinPEAS', description: 'Linux privilege escalation' },
    { id: 'winpeas', name: 'WinPEAS', description: 'Windows privilege escalation' },
    { id: 'pspy', name: 'Pspy', description: 'Process snooping without root' },
    { id: 'rubeus', name: 'Rubeus', description: 'Kerberos abuse toolkit' },
    { id: 'seatbelt', name: 'Seatbelt', description: 'Windows security checks' },
    { id: 'crackmapexec', name: 'CrackMapExec', description: 'Network pentesting swiss army knife' },
    { id: 'evil-winrm', name: 'Evil-WinRM', description: 'WinRM shell for pentesting' },
    { id: 'impacket', name: 'Impacket', description: 'Network protocol toolkit' },
  ],
  pivoting: [
    { id: 'sshuttle', name: 'SSHuttle', description: 'VPN over SSH' },
    { id: 'ligolo', name: 'Ligolo-ng', description: 'Tunneling/pivoting tool' },
    { id: 'rpivot', name: 'Rpivot', description: 'Reverse SOCKS proxy' },
    { id: 'reGeorg', name: 'reGeorg', description: 'SOCKS proxy via web shells' },
    { id: 'plink', name: 'Plink', description: 'PuTTY command-line SSH' },
    { id: 'netsh', name: 'Netsh', description: 'Windows port forwarding' },
  ],
};

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randHex = (len = 32) => Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const now = () => new Date().toLocaleTimeString('en-US', { hour12: false });
const nowFull = () => new Date().toLocaleString();

// ---------- TOOL SIMULATION ----------
export function simulateTool(toolName, params = {}) {
  const t = params.target || '192.168.1.1';
  const port = params.port || 80;
  const service = params.service || 'ssh';

  const outputs = {
    nmap: `Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for ${t}
Host is up (0.00042s latency).
PORT     STATE SERVICE     VERSION
22/tcp   open  ssh         OpenSSH 8.9p1 Ubuntu 3ubuntu0.6
80/tcp   open  http        Apache httpd 2.4.52 ((Ubuntu))
443/tcp  open  ssl/http    Apache httpd 2.4.52
3306/tcp open  mysql       MySQL 8.0.33
8080/tcp open  http-proxy  Squid http proxy 5.7
|_http-title: Admin Panel

Nmap done: 1 IP address (1 host up) scanned in ${(Math.random() * 3 + 2).toFixed(2)} seconds`,

    nikto: `- Nikto v2.5.0
---------------------------------------------------------------------------
+ Target IP:          ${t}
+ Target Hostname:    ${t}
+ Target Port:        ${port}
+ Start Time:         ${nowFull()}
---------------------------------------------------------------------------
+ Server: Apache/2.4.52 (Ubuntu)
+ /: The anti-clickjacking X-Frame-Options header is not present.
+ /: The X-Content-Type-Options header is not set.
+ /: Retrieved x-powered-by header: PHP/8.1.2
+ /admin/: Directory indexing found.
+ OSVDB-3092: /admin/: Admin directory found.
+ OSVDB-3268: /backup/: Directory indexing found.
+ OSVDB-3268: /uploads/: Directory indexing found.
+ /config.php.bak: Backup configuration file found.
+ ${rand(5, 15)} item(s) reported on remote host
---------------------------------------------------------------------------`,

    sqlmap: `[*] starting @ ${now()}
[INFO] testing connection to the target URL
[INFO] checking if the target is protected by WAF/IPS... No WAF detected
[INFO] testing if the target URL content is stable
[INFO] target URL content is stable
[INFO] testing 'AND boolean-based blind - WHERE or HAVING clause'
[INFO] '${t}' appears to be 'AND boolean-based blind' injectable
[CRITICAL] the back-end DBMS is MySQL
web server operating system: Linux Ubuntu
web application technology: Apache 2.4.52, PHP 8.1.2
back-end DBMS: MySQL >= 5.0.12
[INFO] fetching database names
available databases [3]:
[*] information_schema
[*] mysql
[*] webapp_db
[*] ending @ ${now()}`,

    hydra: `Hydra v9.4 (c) 2022 by van Hauser/THC
[DATA] max 16 tasks per 1 server, overall 16 tasks, 14344 login tries
[DATA] attacking ${service}://${t}:${params.port || 22}/
[STATUS] ${rand(100, 500)}.00 tries/min
[${params.port || 22}][${service}] host: ${t} login: admin password: ${params.password || 'admin123'}
[${params.port || 22}][${service}] host