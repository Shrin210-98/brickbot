---
description: Screenshot a page at desktop and mobile via Playwright MCP
argument-hint: <path> [name]
---

Use the playwright MCP to visually verify: $ARGUMENTS

Steps:
1. browser_navigate to http://localhost:5173$1
2. browser_resize to 1280x800, browser_take_screenshot with
   name=$2-desktop (or page-desktop if no name given)
3. browser_resize to 375x812, browser_take_screenshot with
   name=$2-mobile
4. browser_console_messages — list errors only, ignore the React Router
   v7_startTransition warning and the /favicon.ico 404
5. browser_network_requests — list only 4xx and 5xx
6. Report: layout at each size, any horizontal overflow, any empty or
   placeholder section, any image that failed to load.

Screenshots go to /tmp/pw/ (mounted to tmp/pw/ on the host).