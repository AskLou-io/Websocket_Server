/************************************************************
 * Node.js + Express + WS server
 * 
 * 1) Express on port 8080 => Serves a simple HTML UI
 * 2) WebSocket on port 8081 => 
 *    - If device sends "ESP32" or "ESP32 connected", we set espClient = ws
 *    - Otherwise, if a web user sends "start" or "stop", we forward it to espClient
 ************************************************************/

const WebSocket = require("ws");
const express = require("express");
const os = require("os");

// Function to get local IP (for convenience)
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// Ports
const localIP = getLocalIPAddress();
const WS_PORT = 8081;     // WebSocket port
const EXPRESS_PORT = 8080; // Express port

// -------------------- Express for UI ----------------------
const app = express();

// Serve an HTML page with "Start Timer" & "Stop Timer" buttons
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>askLou.io Timer Control</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          background-color: #DEF5E5;
          color: #1F4D3A;
        }
        .header {
          font-size: 2em;
          margin: 20px;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #3BB77E;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          margin: 10px;
        }
        .button:hover {
          background-color: #2a885f;
        }
        .ws-address {
          font-size: 1.2em;
          margin: 20px;
          color: #1F4D3A;
          font-weight: bold;
        }
        .input-box {
          padding: 10px;
          font-size: 1em;
          width: 80%;
          max-width: 400px;
          margin: 10px auto;
        }
        .copy-btn {
          padding: 10px 20px;
          background-color: #3BB77E;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          margin: 10px;
        }
        .copy-btn:hover {
          background-color: #2a885f;
        }
      </style>
    </head>
    <body>
      <h1 class="header">askLou.io Timer Control</h1>

      <div class="ws-address">
        WebSocket Address: 
        <input class="input-box" id="ws-address" value="ws://${localIP}:${WS_PORT}" readonly />
        <button class="copy-btn" onclick="copyToClipboard()">Copy</button>
      </div>

      <p id="status">Status: Not connected</p>

      <button class="button" onclick="sendCommand('start')">Start Timer</button>
      <button class="button" onclick="sendCommand('stop')">Stop Timer</button>

      <script>
        const ws = new WebSocket("ws://${localIP}:${WS_PORT}");

        ws.onopen = () => {
          document.getElementById("status").innerText = "Status: Connected";
        };

        ws.onmessage = (event) => {
          document.getElementById("status").innerText = \`Status: \${event.data}\`;
        };

        ws.onclose = () => {
          document.getElementById("status").innerText = "Status: Disconnected";
        };

        function sendCommand(command) {
          ws.send(command);
        }

        function copyToClipboard() {
          const input = document.getElementById("ws-address");
          input.select();
          input.setSelectionRange(0, 99999); // For mobile
          navigator.clipboard.writeText(input.value);
          alert("WebSocket address copied to clipboard!");
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(EXPRESS_PORT, () => {
  console.log(`Web UI running on http://localhost:${EXPRESS_PORT}`);
});

// -------------------- WebSocket Server --------------------
const wss = new WebSocket.Server({ port: WS_PORT });

let espClient = null; // We'll store the XIAO's socket here

wss.on("connection", (ws) => {
  console.log("Client connected via WS");

  ws.on("message", (data) => {
    const message = data.toString();
    console.log(`Received: ${message}`);

    // If the device identifies itself as "ESP32" or "ESP32 connected"
    if (message === "ESP32" || message === "ESP32 connected") {
      console.log("ESP32 recognized");
      espClient = ws;   // Mark this connection as the device's socket
      return;
    }

    // Otherwise, assume it's a command from the web UI
    // Forward to the espClient if we have one and it's not the same socket
    if (espClient && espClient !== ws) {
      espClient.send(message);
    }
  });

  ws.on("close", () => {
    console.log("WS client disconnected");
    if (ws === espClient) {
      espClient = null;
      console.log("ESP client set to null");
    }
  });
});