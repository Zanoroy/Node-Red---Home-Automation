#!/bin/bash

set -euo pipefail

USERS_FILE="/var/lib/node-red/auth-users.json"
USERNAME=""
ROLE="view_only"

usage() {
  cat <<'EOF'
Usage:
  sudo -A ./add-auth-user.sh <username> [admin|not-admin]

Examples:
  sudo -A ./add-auth-user.sh family admin
  sudo -A ./add-auth-user.sh guest not-admin
EOF
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

USERNAME="$1"
ROLE_INPUT="${2:-not-admin}"

case "${ROLE_INPUT,,}" in
  admin|yes|true|1)
    ROLE="admin"
    ;;
  not-admin|user|view|view_only|no|false|0)
    ROLE="view_only"
    ;;
  *)
    echo "Invalid role '$ROLE_INPUT'. Use 'admin' or 'not-admin'."
    exit 1
    ;;
esac

if [[ -z "$USERNAME" ]]; then
  echo "Username cannot be empty."
  exit 1
fi

read -rsp "Password for $USERNAME: " PASSWORD
echo

if [[ -z "$PASSWORD" ]]; then
  echo "Password cannot be empty."
  exit 1
fi

read -rsp "Confirm password: " PASSWORD_CONFIRM
echo

if [[ "$PASSWORD" != "$PASSWORD_CONFIRM" ]]; then
  echo "Passwords do not match."
  unset PASSWORD PASSWORD_CONFIRM
  exit 1
fi

AUTH_USERNAME="$USERNAME" AUTH_PASSWORD="$PASSWORD" AUTH_ROLE="$ROLE" \
  node <<'NODE'
const fs = require("fs");
const crypto = require("crypto");

const file = "/var/lib/node-red/auth-users.json";
const username = String(process.env.AUTH_USERNAME || "").trim();
const password = String(process.env.AUTH_PASSWORD || "");
const role = String(process.env.AUTH_ROLE || "view_only");

if (!username || !password) {
  throw new Error("Username and password are required.");
}

let db = { users: [] };
if (fs.existsSync(file)) {
  try {
    const existing = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(existing.users)) db = existing;
  } catch (error) {
    throw new Error(`Cannot read ${file}: ${error.message}`);
  }
}

if (!Array.isArray(db.users)) db.users = [];

const iterations = 210000;
const keyLength = 64;
const digest = "sha512";
const salt = crypto.randomBytes(16).toString("base64url");
const passwordHash = crypto.pbkdf2Sync(
  password,
  salt,
  iterations,
  keyLength,
  digest
).toString("hex");

const normalizedUsername = username.toLowerCase();
const existingIndex = db.users.findIndex(
  user => String(user?.username || "").trim().toLowerCase() === normalizedUsername
);

const user = {
  username,
  email: null,
  roles: [role],
  enabled: true,
  salt,
  passwordHash,
  iterations,
  keyLength,
  digest
};

if (existingIndex >= 0) {
  db.users[existingIndex] = user;
  console.log(`Updated existing user '${username}' with role '${role}'.`);
} else {
  db.users.push(user);
  console.log(`Added user '${username}' with role '${role}'.`);
}

fs.mkdirSync("/var/lib/node-red", { recursive: true });
fs.writeFileSync(file, JSON.stringify(db, null, 2), { mode: 0o600 });
NODE

unset PASSWORD PASSWORD_CONFIRM AUTH_USERNAME AUTH_PASSWORD AUTH_ROLE
