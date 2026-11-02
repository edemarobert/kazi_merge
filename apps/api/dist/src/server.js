"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const port = Number(process.env.PORT ?? 4000);
const app = (0, app_js_1.createApp)();
app.listen(port, () => {
    console.log(`Kazi Merge API listening on http://localhost:${port}`);
});
