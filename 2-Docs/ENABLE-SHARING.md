# Enable Full Remote Access for MacBook

## Step 1: Enable Remote Login (SSH)
1. Open **System Settings**
2. Go to **General** → **Sharing**
3. Turn ON **Remote Login**
4. Click (i) info button
5. Set "Allow access for" to **All users** or add your user

## Step 2: Enable File Sharing (SMB)
1. In the same **Sharing** settings
2. Turn ON **File Sharing**
3. Click (i) info button
4. Click **+** under "Shared Folders"
5. Add your home folder: `/Users/opta`
6. Under "Users", set permissions for your user to **Read & Write**

## Step 3: Enable Screen Sharing (Optional)
1. Turn ON **Screen Sharing**
2. Click (i) info button
3. Set "Allow access for" to your user

## Step 4: Add MacBook's SSH Key
Run this on your **MacBook Pro**:
```bash
# Generate key if you don't have one
ssh-keygen -t ed25519 -C "macbook"

# Copy key to Mac Studio
ssh-copy-id opta@192.168.188.144
```

## Step 5: Test Connection (From MacBook)
```bash
# SSH
ssh opta@192.168.188.144

# Mount via Finder
# Press Cmd+K, enter: smb://192.168.188.144

# Screen Sharing
# Press Cmd+K, enter: vnc://192.168.188.144
```

---

## Mac Studio Details
- **IP Address:** 192.168.188.144
- **Hostname:** MatthewacStudio.lan
- **Username:** opta

---

## For Access Outside Home Network

If you want access from anywhere (coffee shop, etc.):

### Option A: Tailscale (Recommended)
```bash
# Already installed, just needs setup:
brew services start tailscale
# Then: open tailscale app and sign in with Apple ID
```

### Option B: SSH over iCloud Private Relay
Requires both Macs on same Apple ID with iCloud.
