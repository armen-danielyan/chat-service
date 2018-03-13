const express = require('express');

let app = express();

app.use(express.static(__dirname + '/public'));

module.exports = app;