const { loadMobileEnv } = require("./load-mobile-env");

loadMobileEnv();

/** @type {import('expo/config').ExpoConfig} */
module.exports = require("./app.json").expo;
