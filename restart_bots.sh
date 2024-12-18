#!/bin/bash

# Restart the first Node.js activity
pm2 restart bsky_bot.mjs

# Restart the second Node.js activity
pm2 restart bsky_nanogptbot.js

# Alternatively, use the direct Node command if not using a process manager
# pkill -f "node activity1.js"
# pkill -f "node activity2.js"
# node /path/to/activity1.js &
# node /path/to/activity2.js &
