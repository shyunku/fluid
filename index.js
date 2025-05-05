const express = require("express");
const path = require("path");
const app = express();
const port = 7000;

app.use(express.static("public"));

// app.all("/", (req, res) => {
//   res.sendFile(path.resolve(__dirname, "public/index.html"));
// });

app.all("/dist/bundle.js", (req, res) => {
  res.sendFile(path.resolve(__dirname, "dist/bundle.js"));
});

app.listen(port, () => {
  console.log(`Listening with port ${port}`);
});
