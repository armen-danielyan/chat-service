const fs = require('fs'),
    chat = require('../libs/chat.js'),
    app = require('../app'),
    http = require('https').Server({
        key: fs.readFileSync('certificates/server.key'),
        cert: fs.readFileSync('certificates/server.crt')
    }, app);;
    // https = require('https').Server(app);

let port = process.env.PORT || 3000;

let chatServer = new chat(http);
chatServer.init();

http.listen(port, '192.168.0.113');

http.on('error', error => {
    if (error.syscall !== 'listen') {
        throw error;
    }

    let bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
});

http.on('listening', () => {
    let addr = http.address(),
        bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    console.log('Listening on ' + bind);
});
