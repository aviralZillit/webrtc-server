const express = require("express");
const { Server } = require("socket.io");
const http = require("http");

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Create a new Socket.io server attached to the HTTP server
const io = new Server(server, {
  cors: true,
});

// Health check route
app.get("/health-check", (req, res) => {
  res.send("ok");
});

// Maps to keep track of connections
const nameToSocketMap = new Map();
const socketIdToUserMap = new Map();

const log = (message, ...additionalInfo) => {
  console.log(`[${new Date().toISOString()}] ${message}`, ...additionalInfo);
};

io.on("connection", (socket) => {
  log("Socket Connected", socket.id);

  socket.on("room:join", (data) => {
    const { name, room } = data;
    nameToSocketMap.set(name, socket.id);
    socketIdToUserMap.set(socket.id, name);
    socket.join(room);

    // Notify other users in the room of the new user
    io.to(room).emit("user:joined", { name, id: socket.id });
    log(`User ${name} joined room ${room}`, { socketId: socket.id });

    // Send confirmation to the new user
    io.to(socket.id).emit("room:join", data);
  });

  socket.on("user:call", ({ to, offer, name }) => {
    if (!io.sockets.sockets.has(to)) {
      log(`Attempted to call non-existent socket ID: ${to}`);
      return;
    }

    // Send call request with the caller's name
    io.to(to).emit("incomming:call", { from: socket.id, offer, name });
    log(`User ${name} (${socket.id}) is calling ${to}`);
  });

  socket.on("call:accepted", ({ to, ans }) => {
    if (!io.sockets.sockets.has(to)) {
      log(`Attempted to accept call for non-existent socket ID: ${to}`);
      return;
    }

    // Notify caller that the call was accepted
    io.to(to).emit("call:accepted", { from: socket.id, ans });
    log(`Call accepted by ${socket.id} for ${to}`);
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    if (!io.sockets.sockets.has(to)) {
      log(`Attempted negotiation with non-existent socket ID: ${to}`);
      return;
    }

    log("Negotiation needed", { from: socket.id, to, offer });
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    if (!io.sockets.sockets.has(to)) {
      log(`Attempted negotiation completion with non-existent socket ID: ${to}`);
      return;
    }

    log("Negotiation done", { from: socket.id, to, ans });
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
    log("Current name-to-socket map", Array.from(nameToSocketMap.entries()));
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    const user = socketIdToUserMap.get(socket.id);
    if (user) {
      nameToSocketMap.delete(user);
      socketIdToUserMap.delete(socket.id);
      log(`User ${user} disconnected`, { socketId: socket.id });
    } else {
      log("Unknown user disconnected", { socketId: socket.id });
    }
  });
});

// Start the HTTP server and the Socket.io server
const PORT = 8000;
server.listen(PORT, () => {
  log(`Server is running on port ${PORT}`);
});