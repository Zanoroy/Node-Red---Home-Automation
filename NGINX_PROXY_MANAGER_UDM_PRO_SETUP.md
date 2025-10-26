# Nginx Proxy Manager on UDM Pro - Complete Setup Guide

## Overview
This guide will help you install Nginx Proxy Manager (NPM) on your UDM Pro to securely expose Node-RED and other services to the internet with SSL.

---

## Prerequisites
- UDM Pro with SSH access enabled
- Domain name pointing to your public IP
- Port 80 and 443 forwarded to UDM Pro (or will set up during install)

---

## Step 1: Enable SSH on UDM Pro

1. Log into UniFi Network Controller
2. Go to **Settings** → **System** → **Advanced**
3. Enable **SSH**
4. Set a strong SSH password

---

## Step 2: SSH into UDM Pro

```bash
ssh root@<UDM_PRO_IP>
# Default username: root
# Password: Your UniFi admin password
```

---

## Step 3: Install on-boot-script (Persists across reboots)

UDM Pro wipes custom containers on firmware updates, so we need persistence:

```bash
# Download and install on-boot-script
curl -L https://raw.githubusercontent.com/unifi-utilities/unifios-utilities/main/on-boot-script/install.sh | sh

# Create persistence directory
mkdir -p /data/custom/npm
```

---

## Step 4: Create Docker Compose File

```bash
# Navigate to custom directory
cd /data/custom/npm

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - '80:80'     # HTTP
      - '81:81'     # Admin interface
      - '443:443'   # HTTPS
    environment:
      DB_SQLITE_FILE: "/data/database.sqlite"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - npm_network

networks:
  npm_network:
    driver: bridge
EOF
```

---

## Step 5: Create Boot Script

```bash
# Create startup script
cat > /data/on_boot.d/20-nginx-proxy-manager.sh << 'EOF'
#!/bin/sh

# Start Nginx Proxy Manager on boot
if [ -f /data/custom/npm/docker-compose.yml ]; then
    cd /data/custom/npm
    /usr/bin/docker-compose up -d
fi
EOF

# Make it executable
chmod +x /data/on_boot.d/20-nginx-proxy-manager.sh
```

---

## Step 6: Start Nginx Proxy Manager

```bash
cd /data/custom/npm
docker-compose up -d
```

Check if it's running:
```bash
docker ps | grep nginx-proxy-manager
```

---

## Step 7: Access NPM Admin Interface

1. Open browser: `http://<UDM_PRO_IP>:81`
2. Default login:
   - **Email:** `admin@example.com`
   - **Password:** `changeme`
3. **IMMEDIATELY CHANGE** the password after first login!

---

## Step 8: Configure Port Forwarding on UDM Pro

### Via UniFi Network UI:

1. Go to **Settings** → **Internet** → **Port Forwarding**
2. Create New Port Forward Rule:

**Rule 1 - HTTP:**
- Name: `NPM-HTTP`
- Port: `80`
- Forward IP: `<UDM_PRO_IP>` (e.g., 192.168.1.1)
- Forward Port: `80`
- Protocol: `TCP`

**Rule 2 - HTTPS:**
- Name: `NPM-HTTPS`
- Port: `443`
- Forward IP: `<UDM_PRO_IP>`
- Forward Port: `443`
- Protocol: `TCP`

---

## Step 9: Add Node-RED as Proxy Host in NPM

1. In NPM admin interface, click **Hosts** → **Proxy Hosts**
2. Click **Add Proxy Host**

### Details Tab:
```
Domain Names: nodered.yourdomain.com
Scheme: http
Forward Hostname/IP: <NODE_RED_SERVER_IP> (e.g., 172.17.254.10)
Forward Port: 1880
Cache Assets: ✓
Block Common Exploits: ✓
Websockets Support: ✓  (IMPORTANT for Node-RED!)
```

### SSL Tab:
```
SSL Certificate: Request a new SSL Certificate
Force SSL: ✓
HTTP/2 Support: ✓
HSTS Enabled: ✓

Email: your-email@example.com
✓ I Agree to the Let's Encrypt Terms of Service
```

3. Click **Save**

---

## Step 10: Add UIBuilder Dashboard

Repeat Step 9 with these settings:

```
Domain Names: dashboard.yourdomain.com
Forward Hostname/IP: 172.17.254.10
Forward Port: 1880/dashboard  (Note: Use path /dashboard)
```

Or set up as a custom location:

### Custom Locations Tab:
```
Define Custom Location: /dashboard
Scheme: http
Forward Hostname/IP: 172.17.254.10
Forward Port: 1880
Forward Path: /dashboard
```

---

## Step 11: DNS Configuration

Point your domain to your public IP:

### At your DNS provider (e.g., Cloudflare, GoDaddy):

```
Type: A
Name: nodered
Content: <YOUR_PUBLIC_IP>
TTL: Auto

Type: A
Name: dashboard  
Content: <YOUR_PUBLIC_IP>
TTL: Auto
```

---

## Step 12: Enable Node-RED Authentication (IMPORTANT!)

Even with NPM, enable Node-RED's built-in auth:

```bash
# On your Node-RED server
cd /root/.node-red

# Install bcrypt for password hashing
npm install bcryptjs

# Generate password hash
node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 8));"
```

Copy the hash, then edit `settings.js`:

```javascript
adminAuth: {
    type: "credentials",
    users: [{
        username: "admin",
        password: "$2a$08$YOUR_HASH_HERE",
        permissions: "*"
    }]
},
```

Restart Node-RED:
```bash
pm2 restart 0
```

---

## Step 13: Advanced Security (Recommended)

### Add Access List in NPM:

1. Go to **Access Lists** → **Add Access List**
2. Name: `Restricted Access`
3. **Authorization Tab:**
   ```
   Username: admin
   Password: <strong-password>
   ```
4. **Access Tab** (Optional - IP whitelist):
   ```
   Allow: 
   - Your home IP
   - Your office IP
   Deny: All others
   ```

### Apply to Node-RED Host:
1. Edit your Node-RED proxy host
2. **Details Tab** → Access List: Select `Restricted Access`
3. Save

Now users need BOTH:
- NPM authentication
- Node-RED authentication

---

## Step 14: UDM Pro Firewall Rules (Extra Protection)

### Via UniFi Network UI:

1. **Settings** → **Security** → **Firewall & Security**
2. Enable **Threat Management**
3. Enable **IPS (Intrusion Prevention System)**

### Create Firewall Rule:

**Settings** → **Security** → **Firewall** → **Create New Rule**

```
Type: Internet In
Action: Accept
Protocol: TCP
Destination Port: 443
Destination: <NPM_IP>
Description: Allow HTTPS to NPM only
```

---

## Maintenance & Updates

### Update NPM:
```bash
cd /data/custom/npm
docker-compose pull
docker-compose up -d
```

### View Logs:
```bash
docker logs -f nginx-proxy-manager
```

### Restart NPM:
```bash
cd /data/custom/npm
docker-compose restart
```

### Stop NPM:
```bash
cd /data/custom/npm
docker-compose down
```

---

## Troubleshooting

### NPM won't start:
```bash
# Check if ports are in use
netstat -tulpn | grep -E '80|443|81'

# If UDM Pro's web interface uses 443, you may need to:
# 1. Use different external port (e.g., 8443)
# 2. Or disable UDM Pro's web UI on WAN interface
```

### SSL Certificate fails:
- Ensure ports 80 & 443 are forwarded correctly
- Check DNS propagation: `nslookup nodered.yourdomain.com`
- Verify domain points to public IP: `curl ifconfig.me`

### WebSocket connection fails:
- Ensure "Websockets Support" is enabled in NPM proxy host
- Check Node-RED logs for connection errors

### Can't access after reboot:
```bash
# Check if on-boot script ran
ls -la /data/on_boot.d/

# Manually start if needed
cd /data/custom/npm
docker-compose up -d
```

---

## Security Best Practices

1. ✅ **Change default NPM password immediately**
2. ✅ **Enable 2FA in NPM** (Settings → Users → Edit → Enable 2FA)
3. ✅ **Use strong passwords** for all authentication layers
4. ✅ **Keep NPM updated** regularly
5. ✅ **Monitor access logs** in NPM dashboard
6. ✅ **Enable UDM Pro Threat Management**
7. ✅ **Use Cloudflare** for additional DDoS protection (optional)
8. ✅ **Regular backups** of `/data/custom/npm` directory
9. ✅ **Limit access by IP** if possible
10. ✅ **Monitor UDM Pro logs** for suspicious activity

---

## Backup Configuration

```bash
# Backup NPM data
cd /data/custom/npm
tar -czf npm-backup-$(date +%Y%m%d).tar.gz data/ letsencrypt/

# Copy to safe location
scp npm-backup-*.tar.gz user@backup-server:/backups/
```

---

## Optional: Cloudflare Integration

For extra protection, put Cloudflare in front:

1. **Transfer domain to Cloudflare** (or use Cloudflare DNS)
2. **Enable Cloudflare Proxy** (orange cloud) for A records
3. **SSL/TLS Settings** → Full (strict)
4. **In NPM:** Add Cloudflare Origin Certificate instead of Let's Encrypt
5. **Enable Cloudflare Firewall Rules:**
   - Challenge visitors from suspicious countries
   - Rate limit requests
   - Block known bad bots

---

## Testing Your Setup

1. **Test HTTP → HTTPS redirect:**
   ```bash
   curl -I http://nodered.yourdomain.com
   # Should see: Location: https://nodered.yourdomain.com
   ```

2. **Test SSL certificate:**
   ```bash
   openssl s_client -connect nodered.yourdomain.com:443 -servername nodered.yourdomain.com
   # Should show valid Let's Encrypt certificate
   ```

3. **Test Node-RED access:**
   - Visit `https://nodered.yourdomain.com`
   - Should prompt for authentication
   - Should load Node-RED editor

4. **Test UIBuilder Dashboard:**
   - Visit `https://dashboard.yourdomain.com`
   - Should load your dashboard

---

## Complete Architecture Diagram

```
Internet
    ↓
[Port 443 Forward]
    ↓
UDM Pro (Firewall/IPS)
    ↓
Nginx Proxy Manager (SSL/Auth)
    ↓
Internal Network
    ↓
Node-RED Server (172.17.254.10:1880)
    ↓
UIBuilder Dashboard (/dashboard)
```

---

## Support Resources

- **NPM Documentation:** https://nginxproxymanager.com/
- **UDM Pro on-boot-script:** https://github.com/unifi-utilities/unifios-utilities
- **UniFi Community:** https://community.ui.com/
- **Let's Encrypt Docs:** https://letsencrypt.org/docs/

---

## Quick Reference Commands

```bash
# SSH to UDM Pro
ssh root@<UDM_IP>

# Start NPM
cd /data/custom/npm && docker-compose up -d

# Stop NPM
cd /data/custom/npm && docker-compose down

# View logs
docker logs -f nginx-proxy-manager

# Update NPM
cd /data/custom/npm && docker-compose pull && docker-compose up -d

# Restart Node-RED
pm2 restart 0

# Check Node-RED is running
curl http://172.17.254.10:1880

# Test external access
curl -I https://nodered.yourdomain.com
```

---

## Next Steps After Setup

1. Test access from outside your network (use mobile data)
2. Set up monitoring/alerts for failed login attempts
3. Configure automatic backups
4. Document your configuration
5. Test disaster recovery procedures

---

**Need Help?** 

If you run into issues during setup, let me know which step is causing problems and I can provide specific troubleshooting guidance.
