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

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);

  socket.on("room:join", (data) => {
    const {  name, room  } = data;
    nameToSocketMap.set(name, socket.id);
    socketIdToUserMap.set(socket.id, name);
    socket.join(room);

    // Notify other users in the room of the new user
    io.to(room).emit("user:joined", { name, id: socket.id });

    // Send confirmation to the new user
    io.to(socket.id).emit("room:join", data);
  });

  socket.on("user:call", ({ to, offer, name }) => {
    // Send call request with the caller's name
    io.to(to).emit("incomming:call", { from: socket.id, offer, name });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    // Notify caller that the call was accepted
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log("peer:nego:needed", offer);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log("peer:nego:done", ans);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
    console.log("name to socket map :",nameToSocketMap);
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    const user = socketIdToUserMap.get(socket.id);
    if (user) {
      nameToSocketMap.delete(user.name);
      socketIdToUserMap.delete(socket.id);
    }
    console.log(`Socket Disconnected`, socket.id);
  });
});

// Start the HTTP server and the Socket.io server
const PORT = 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});