import express from "express";
import path from "path";
import { resolve } from "path";
const app = express();
const port = 7000;

app.use(express.static("public"));
app.use("/dist", express.static("dist"));
app.use("/src", express.static("src"));
app.use("/test", express.static("test"));
app.use("/tests-e2e", express.static("tests-e2e"));

const __dirname = path.resolve();

app.all("/", (req, res) => {
  res.redirect("/dev/react");
});

app.all("/dev/react", (req, res) => {
  res.sendFile(resolve(__dirname, "src/react/__tests__/index.html"));
});

app.all("/dev/react/test", (req, res) => {
  res.sendFile(resolve(__dirname, "src/react/__tests__/test.html"));
});

app.all("/dev/jsx", (req, res) => {
  res.sendFile(resolve(__dirname, "src/jsx/__tests__/index.html"));
});

app.all("/prod/react", (req, res) => {
  res.sendFile(resolve(__dirname, "tests-e2e/react/index.html"));
});

app.all("/prod/jsx", (req, res) => {
  res.sendFile(resolve(__dirname, "tests-e2e/jsx/index.html"));
});

app.listen(port, () => {
  console.log(`Listening with port ${port}`);
});
