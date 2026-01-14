"use strict";

/**
 *
 * Tesseract Worker Script for Node
 *
 * @fileoverview Node worker implementation
 * @author Kevin Kwok <antimatter15@gmail.com>
 * @author Guillermo Webster <gui@mit.edu>
 * @author Jerome Wu <jeromewus@gmail.com>
 */
// Use built-in fetch if available, otherwise fallback to node-fetch
const fetch = global.fetch || require("node-fetch");
const { parentPort } = require("worker_threads");
const worker = require("./worker.js");
const getCore = require("./getCore.js");
const gunzip = require("./gunzip.js");
const cache = require("./cache.js");

/*
 * register message handler
 */
parentPort.on("message", (packet) => {
  worker.dispatchHandlers(packet, (obj) => parentPort.postMessage(obj));
});

worker.setAdapter({
  getCore,
  gunzip,
  fetch,
  ...cache,
});
