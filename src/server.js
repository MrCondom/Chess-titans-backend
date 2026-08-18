const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const playersRoutes = require("./routes/players");
const teamsRoutes = require("./routes/teams");
const pairingsRoutes = require("./routes/pairings")
const adminRoutes = require("./routes/admin")
const rankingsRoutes = require("./routes/rankings")

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Chess Rating Backend is running 🏁");
});

app.use("/players", playersRoutes);
app.use("/teams", teamsRoutes);
app.use("/pairings", pairingsRoutes);
app.use("/admin", adminRoutes)
app.use("/rankings", rankingsRoutes)


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
