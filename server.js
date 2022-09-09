const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");
const { nanoid } = require("@reduxjs/toolkit");

const app = express();
app.use(cors(""));
app.use(express.static("public"));

const httpServer = app.listen(process.env.PORT || 8371 || 3333);

const io = new Server(httpServer, {
  cors: {
    origins: "*",
  },
});

// Check game status
function ticTacToeGameStatus(board, player) {
  function hasPlayerWon(player) {
    if (board[0][0] === player && board[0][1] === player && board[0][2] === player) {
      return true;
    } else if (board[1][0] === player && board[1][1] === player && board[1][2] === player) {
      return true;
    } else if (board[2][0] === player && board[2][1] === player && board[2][2] === player) {
      return true;
    } else if (board[0][0] === player && board[1][0] === player && board[2][0] === player) {
      return true;
    } else if (board[0][1] === player && board[1][1] === player && board[2][1] === player) {
      return true;
    } else if (board[0][2] === player && board[1][2] === player && board[2][2] === player) {
      return true;
    } else if (board[0][0] === player && board[1][1] === player && board[2][2] === player) {
      return true;
    } else if (board[0][2] === player && board[1][1] === player && board[2][0] === player) {
      return true;
    }
    return false;
  }

  if (hasPlayerWon(player)) {
    return player === "X" ? "Player X has won" : "Player O has won";
  } else if (board[0].includes(" ") || board[1].includes(" ") || board[2].includes(" ")) {
    return "Game in Progress";
  } else {
    return "Draw";
  }
}

// Randomize who begins first
function randomPlayer() {
  return Math.ceil(Math.random() * 10) % 2 === 0 ? "X" : "O";
}

const rooms = {};
let startingBoard = new Array(3).fill(0).map((el) => new Array(3).fill(" "));

io.on("connection", (socket) => {
  console.log("Client connected", socket.id);

  socket.on("getRooms", () => {
    io.emit("gotRooms", rooms);
    console.log("rooms sent");
  });

  socket.on("addRoom", (userId) => {
    const roomNo = nanoid();
    rooms[roomNo] = { roomAdmin: userId, roomNo, players: {}, moves: {}, board: JSON.parse(JSON.stringify(startingBoard)), started: false };
    console.log(rooms);
  });

  socket.on("delRoom", (roomNo) => {
    delete rooms[roomNo];
    io.emit("gotRooms", rooms);
  });

  socket.on("whoStart", async (roomNo) => {
    console.log("ROOMNO:", roomNo);
    // await roomNo;
    rooms[roomNo].started = true;
    if (roomNo) {
      rooms[roomNo].currentPlayer = !rooms[roomNo].currentPlayer ? randomPlayer() : rooms[roomNo].currentPlayer;
      io.emit("starter", { roomNo, currentPlayer: rooms[roomNo].currentPlayer });
    }
  });

  socket.on("writeSign", async ({ row, col, roomNo, player }) => {
    if (roomNo && player === rooms[roomNo].currentPlayer) {
      rooms[roomNo].board[row][col] = player;
      const gameStatus = ticTacToeGameStatus(rooms[roomNo].board, player);
      console.log("GAMESTATUS:", gameStatus);

      if (gameStatus === "Game in Progress" || gameStatus === "Player X has won" || gameStatus === "Player O has won" || gameStatus === "Draw") {
        rooms[roomNo].currentPlayer = rooms[roomNo].currentPlayer === "X" ? "O" : "X";
        io.emit("gameContinue", { roomNo, currentPlayer: rooms[roomNo].currentPlayer, board: rooms[roomNo].board, gameStatus });
        console.log("sent gameContinue");
      }

      if (gameStatus === "Player X has won" || gameStatus === "Player O has won" || gameStatus === "Draw") {
        delete rooms[roomNo];
        io.emit("gotRooms", rooms);
      }
    }
  });

  socket.on("connectPlayerX", ({ userId, room }) => {
    console.log(new Date() + " Recieved a new connection from origin " + socket.handshake.headers.host + ".");
    if (!rooms[room].started) {
      if (!rooms[room].players.X) rooms[room].players.X = userId;
      if (rooms[room].players.O === userId && !rooms[room].players.X) delete rooms[room].players.O;
      io.emit("gotRooms", rooms);
      io.emit("connectedPlayers", { players: rooms[room].players, room });
      console.log(`PlayerX:${userId} connected to Room:${room}`);
      console.log("ROOMSSTATUS:", rooms[room].players);
    }
  });

  socket.on("connectPlayerO", ({ userId, room }) => {
    console.log(new Date() + " Recieved a new connection from origin " + socket.handshake.headers.host + ".");
    if (!rooms[room].started) {
      if (!rooms[room].players.O) rooms[room].players.O = userId;
      if (rooms[room].players.X === userId && !rooms[room].players.O) delete rooms[room].players.X;
      io.emit("gotRooms", rooms);
      io.emit("connectedPlayers", { players: rooms[room].players, room });
      console.log(`PlayerO:${userId} connected to Room:${room}`);
      console.log("ROOMSSTATUS:", rooms[room].players);
    }
  });

  socket.on("disconnect", () => console.log("Client disconnected"));
});
