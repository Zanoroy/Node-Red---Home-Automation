#!/bin/bash
# Sanitize flows.json before committing to remove sensitive data

# Make a copy for GitHub
cp flows.json flows-sanitized.json

# Replace sensitive values with placeholders
sed -i 's/c978917f-7089-4041-937f-414a0bb2ab6d/YOUR_HUBITAT_ACCESS_TOKEN/g' flows-sanitized.json
sed -i 's/172\.17\.98\.214/YOUR_HUBITAT_IP/g' flows-sanitized.json
sed -i 's/172\.17\.254\.10/YOUR_SERVER_IP/g' flows-sanitized.json

echo "Sanitized flows saved to flows-sanitized.json"
echo "You can safely commit this file to GitHub"
