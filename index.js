// =============================================================
// Task List Manager — MCP Server
// =============================================================
// This server exposes three tools (add_task, list_tasks,
// complete_task) and one resource (task_list) over the Model
// Context Protocol using stdio transport.
// =============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

// ── Path to the JSON file that stores all tasks ──────────────
const TASKS_FILE = path.resolve("tasks.json");

// =============================================================
// Helper: read tasks from disk
// =============================================================
// If the file doesn't exist yet we return an empty array so the
// server works right away without any manual setup.
// =============================================================
async function readTasks() {
  try {
    const data = await fs.readFile(TASKS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid — start fresh
    if (error.code === "ENOENT" || error instanceof SyntaxError) {
      return [];
    }
    throw error; // Re-throw unexpected errors
  }
}

// =============================================================
// Helper: write tasks to disk
// =============================================================
// We pretty-print the JSON (2-space indent) so the file stays
// easy to read if you ever open it in an editor.
// =============================================================
async function writeTasks(tasks) {
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

// =============================================================
// Helper: find the next available task ID
// =============================================================
// Looks at the highest existing ID and adds 1.  If the list is
// empty the first task gets ID 1.
// =============================================================
function getNextId(tasks) {
  if (tasks.length === 0) return 1;
  return Math.max(...tasks.map((t) => t.id)) + 1;
}

// =============================================================
// Create the MCP server
// =============================================================
const server = new McpServer({
  name: "task-list-manager",
  version: "1.0.0",
});

// =============================================================
// TOOL 1: add_task
// =============================================================
// Creates a new task with the given title, assigns it an auto-
// incrementing ID, sets completed to false, and records the
// current timestamp.  The task is appended to tasks.json.
// =============================================================
server.tool(
  "add_task",
  "Add a new task to the task list",
  {
    // The title is the only required input
    title: z.string().describe("The title / description of the task"),
  },
  async ({ title }) => {
    // 1. Load current tasks from disk
    const tasks = await readTasks();

    // 2. Build the new task object
    const newTask = {
      id: getNextId(tasks),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    // 3. Append and save
    tasks.push(newTask);
    await writeTasks(tasks);

    // 4. Return a human-readable confirmation
    return {
      content: [
        {
          type: "text",
          text: `Task added successfully!\n\n  ID:    ${newTask.id}\n  Title: ${newTask.title}\n  Date:  ${newTask.createdAt}`,
        },
      ],
    };
  }
);

// =============================================================
// TOOL 2: list_tasks
// =============================================================
// Returns every task in a nicely formatted list.  Each task
// shows its ID, title, status (pending / done), and creation
// date.  If there are no tasks yet a friendly message is shown.
// =============================================================
server.tool("list_tasks", "List all tasks", {}, async () => {
  const tasks = await readTasks();

  // Handle the empty case
  if (tasks.length === 0) {
    return {
      content: [{ type: "text", text: "No tasks yet. Use add_task to create one!" }],
    };
  }

  // Format each task as a readable line
  const formatted = tasks
    .map((t) => {
      const status = t.completed ? "done" : "pending";
      return `[${t.id}] ${t.title}  (${status})  — created ${t.createdAt}`;
    })
    .join("\n");

  return {
    content: [
      {
        type: "text",
        text: `Tasks (${tasks.length}):\n\n${formatted}`,
      },
    ],
  };
});

// =============================================================
// TOOL 3: complete_task
// =============================================================
// Marks an existing task as completed by its ID.  Returns an
// error message if no task with that ID exists.
// =============================================================
server.tool(
  "complete_task",
  "Mark a task as completed",
  {
    id: z.number().describe("The ID of the task to mark as completed"),
  },
  async ({ id }) => {
    const tasks = await readTasks();

    // Look up the task by ID
    const task = tasks.find((t) => t.id === id);

    if (!task) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: No task found with ID ${id}.`,
          },
        ],
      };
    }

    // Already completed? Let the caller know.
    if (task.completed) {
      return {
        content: [
          {
            type: "text",
            text: `Task ${id} ("${task.title}") is already marked as completed.`,
          },
        ],
      };
    }

    // Mark as done and persist
    task.completed = true;
    await writeTasks(tasks);

    return {
      content: [
        {
          type: "text",
          text: `Task ${id} ("${task.title}") marked as completed!`,
        },
      ],
    };
  }
);

// =============================================================
// RESOURCE: task_list
// =============================================================
// Exposes the raw contents of tasks.json so that an LLM (or any
// MCP client) can read the full task list as structured data.
// =============================================================
server.resource("task_list", "tasks://list", "The complete task list as JSON", async () => {
  const tasks = await readTasks();

  return {
    contents: [
      {
        uri: "tasks://list",
        mimeType: "application/json",
        text: JSON.stringify(tasks, null, 2),
      },
    ],
  };
});

// =============================================================
// Start the server
// =============================================================
// We use the Stdio transport — the MCP client communicates with
// this process over stdin / stdout.
// =============================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Task List Manager MCP server is running.");
}

main().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});
