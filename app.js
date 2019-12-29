const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const getIP = require("ipware")().get_ip;
const http = require("http");

const app = express();


// Cross Origin Resource Sharing unactivate: make other domain request accessable.
app.use(cors());


const port = 80;
// const ip = "localhost";
const server = http.createServer(app);
const io = require("socket.io")(server);

server.listen(port, () => {
    console.log("CDEDAY server started: " + port);
});


// Today & Time Analytics Algorithm

function getTime() {
    var date = new Date().getDate();
    if (date < 10) {
        date = '0' + date
    }

    var month = new Date().getMonth()+1;
    if (month < 10) {
        month = '0' + month
    }

    var hour = new Date().getHours();
    if (hour < 10) {
        hour = '0' + hour
    }

    var minute = new Date().getMinutes();
    if (minute < 10) {
        minute = '0' + minute
    }

    var second = new Date().getSeconds();
    if (second < 10) {
        second = '0' + second
    }


    return '' + new Date().getFullYear() + month + date + "-" + hour + ":" + minute + ":" + second;
}




app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

// app.use(express.static(__dirname));

// log accessed ip

app.use((req, res, next) => {
    const ipInfo = getIP(req);
    fs.appendFile(path.join(__dirname, "acclog.log"), 
        `
        time: ` + getTime() + `,
        ip: ` + ipInfo.clientIp + `,
        router: ` + req.originalUrl + `,
        header: ` + JSON.stringify(req.headers) + `,
        body: ` + JSON.stringify(req.body) + `
        `
        , function(err) {
        if (err) console.log("Logging ERR:\n" + err);
        else console.log("\n" + "Accessed IP: " + ipInfo.clientIp + ", Access route: " + req.originalUrl + ", Method: " + req.method + ", Time: " + getTime() + "\n");
    })
    setTimeout(() => {
        next();
    }, 100);
});

// session setting
app.use(session({
    key: "CDEDAY-key",
    secret:"@#$(%JGRVMEIO)Q@TRDCCQ#$%RE@Wdfe424rr0jfrfi",
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 60 * 60 * 10000
    }
}))


// random string



// router

app.use('/', require('./router'));
app.use('/payment', require('./prouter'));
// app.use('/payment', require("./prouter") (app, fs, path, crypto, multer, async, getIP, utf8, iconv, mime, axios, mimeTypes, getTime, makeid, mysql_query));

