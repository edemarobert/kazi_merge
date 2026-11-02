"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const node_http_1 = require("node:http");
const app_js_1 = require("../src/app.js");
(0, node_test_1.test)("health endpoint reports an available API shell", async () => {
    const server = (0, node_http_1.createServer)((0, app_js_1.createApp)());
    await new Promise((resolve) => server.listen(0, resolve));
    const address = server.address();
    strict_1.default.ok(address && typeof address !== "string");
    try {
        const response = await fetch(`http://localhost:${address.port}/api/v1/health`);
        strict_1.default.equal(response.status, 200);
        strict_1.default.deepEqual(await response.json(), {
            status: "ok",
            service: "api",
        });
    }
    finally {
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
});
