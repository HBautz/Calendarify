"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
exports.default = (0, test_1.defineConfig)({
    webServer: {
        command: 'node server.js',
        port: 3000,
        reuseExistingServer: true,
    },
});
//# sourceMappingURL=playwright.config.js.map