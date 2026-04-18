'use strict';

const http = require('node:http');
const https = require('node:https');

function makeRequest(urlString, timeoutMs) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      reject(new Error('Invalid probe URL.'));
      return;
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname || '/',
        method: 'GET',
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        resolve({
          ok: true,
          statusCode: res.statusCode || 0,
          statusMessage: res.statusMessage || '',
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Probe request timed out.'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

async function probeEndpoint(url, timeoutMs = 3000) {
  try {
    const result = await makeRequest(url, timeoutMs);
    return {
      ok: true,
      statusCode: result.statusCode,
      message: `${result.statusCode} ${result.statusMessage}`.trim(),
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 0,
      message: err.message,
    };
  }
}

module.exports = {
  probeEndpoint,
};
