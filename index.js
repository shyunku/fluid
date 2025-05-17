const express = require("express");
const path = require("path");
const app = express();
const port = 7000;

app.use(express.static("public"));
app.use("/dist", express.static("dist"));
app.use("/src", express.static("src"));
app.use("/test", express.static("test"));

app.all("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public/react/index.html"));
});

app.listen(port, () => {
  console.log(`Listening with port ${port}`);
});
