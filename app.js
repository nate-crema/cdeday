const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql");
const cors = require("cors");
const crypto = require("crypto");
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

// log accessed ip

app.use((req, res, next) => {
    const ipInfo = getIP(req);
    fs.appendFile(path.join(__dirname, "acclog.log"), 
        `
        time: ` + getTime() + `,
        ip: ` + ipInfo.clientIp + `,
        router: ` + req.originalUrl + `
        `
        , function(err) {
        if (err) console.log("Logging ERR:\n" + err);
        else console.log("Accessed IP: " + ipInfo.clientIp + ", Access route: " + req.originalUrl + ", Time: " + getTime());
    })
    next();
});


app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

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


// mysql access command

const conn_mysql = mysql.createConnection({
    host: "175.116.45.38",
    user: "cdeday",
    password: "cdeday_test+",
    port: 3306,
    database: "cdeday"
});

conn_mysql.connect();

function mysql_query(q_comm) {
    return new Promise((resolve, reject) => {
        conn_mysql.query(q_comm, (err, rows, fields) => {
            if (err) reject("Query ERR: " + err);
            else resolve(rows);
        })
    })
}

mysql_query("show tables")
.then((res) => {
    if (res.length != 0) {
        console.log("Connected to Mysql DB");
    }
})


// router
const router = require("./router") (app, fs, path, crypto, getIP, mysql, mysql_query);