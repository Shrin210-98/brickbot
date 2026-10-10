---
description: Screenshot a page at desktop and mobile via Playwright MCP
argument-hint: <path> [name]
---

Use the playwright MCP to visually verify: $ARGUMENTS

Arguments are zero-indexed: $0 is the path (e.g. / or /listings), $1 is
the screenshot name (e.g. step6). If no name is given, use "page".

Steps:
1. browser_navigate to http://localhost:5173$0
2. browser_resize to 1280x800, browser_take_screenshot with
   filename=/tmp/pw/$1-desktop.png
3. browser_resize to 375x812, browser_take_screenshot with
   filename=/tmp/pw/$1-mobile.png
4. browser_console_messages — list errors only, ignore the React Router
   v7_startTransition warning and the /favicon.ico 404
5. browser_network_requests — list only 4xx and 5xx
6. Report: layout at each size, any horizontal overflow, any empty or
   placeholder section, any image that failed to load.

Screenshots go to /tmp/pw/ (mounted to tmp/pw/ on the host).