# Process

## Overview
This project is a Task List Manager built as an MCP (Model Context Protocol) server. It allows an AI assistant to manage tasks through structured tools and resources over stdio transport.

## Development Steps

1. **Set up the project** — Initialized a Node.js project and installed the MCP SDK and Zod for input validation.

2. **Built the core helpers** — Created `readTasks` and `writeTasks` functions to read and write task data to `tasks.json`.

3. **Defined the tools** — Implemented three MCP tools: `add_task`, `list_tasks`, and `complete_task`, each with clear input schemas.

4. **Added the resource** — Exposed the full task list as a readable MCP resource at `tasks://list`.

5. **Improved error handling** — Updated `readTasks` to automatically create `tasks.json` if it is missing or corrupted.
