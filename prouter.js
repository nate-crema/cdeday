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
const async = require("async");
const multer = require("multer");
const utf8 = require("utf8");
const iconv = require("iconv-lite");
const mime = require("mime");
const mimeTypes = require("mime-types");
const axios = require("axios");

const app = express.Router();


const server_mode = "development";

// response function
function res_end(res, code, err, err_position, cont, note) {
    if (note && server_mode == "development") {
        res.json({
            status: code,
            contents: cont,
            error: {
                position: err_position,
                errors: err,
                note: note
            }
        });
    } else {
        if (server_mode == "development") {
            res.json({
                status: code,
                contents: cont,
                error: {
                    position: err_position,
                    errors: err
                }
            });
        } else if (server_mode == "service") {
            res.json({
                status: code,
                contents: cont,
                errors: err
            });
        }
    }
}

// mysql access command

const conn_mysql = mysql.createConnection({
    host: "222.117.33.139",
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


// random string

function makeid(length, type) {
    let characters;
    if (type == "num") {
        characters = '0123456789';
    } else {
        characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    }
    var result = '';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}


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


// pay function

    // pay logger

    function logger(userid, paymethod, methodinfo, paytype, price, ip, currency, prod_id, paym_id, note) {
        const fullTime = getTime();
        const date = fullTime.split("-")[0];
        const time = fullTime.split("-")[1];
        if (paymethod == "card") {
            // payment id rules check
            const paymid_dist = '' + paym_id.split("")[0] + paym_id.split("")[1] + paym_id.split("")[2];
            if (paymid_dist == "c21") {
                const command = "INSERT INTO payCard (userid, date, time, cardnum, expiry, paytype, price, paydue, ip, currency, prod_id, paym_id, status) VALUES ('" + userid + "', '" + date + "', '" + time + "', '" + methodinfo.cardnum + "', '" + methodinfo.expiry + "', '" + paytype + "', " + price + ", '" + methodinfo.paydue + "', '" + ip + "', '" + currency + "', '" +prod_id + "', '" +paym_id + "', " + 0 + ")";
                mysql_query(command)
                .then((res_sql) => {
                    console.log(res_sql);
                    return {
                        code: 200,
                        cont: "Write log complete:" + paym_id
                    };
                })
                .catch((e) => {
                    return {
                        code: 400,
                        cont: "ERR: unidentified error \n" + e
                    }
                });
            } else {
                return {
                    code: 400,
                    cont: "ERR: Invalid payment id: " + paym_id
                };
            }

        } else if (paymethod == "account") {
            // payment id rules check
            const paymid_dist = '' + paym_id.split("")[0] + paym_id.split("")[1] + paym_id.split("")[2];
            if (paymid_dist == "v24") {
                const command = "INSERT INTO payAcc (userid, date, time, bank, depositor, accnum, due_acc, paytype, price, paydue, ip, currency, prod_id, paym_id, status) VALUES ('" + userid + "', '" + date + "', '" + time + "', '" + methodinfo.bank + "', '" + methodinfo.depositor + "', '" + methodinfo.accnum + "', '" + methodinfo.due_acc + "', '" + paytype + "', " + price + ", '" + 0 + "', '" + ip + "', '" + currency + "', '" +prod_id + "', '" +paym_id + "', " + 0 + ")";
                mysql_query(command)
                .then((res_sql) => {
                    console.log(res_sql);
                    return {
                        code: 200,
                        cont: "Write log complete:" + paym_id
                    };
                })
                .catch((e) => {
                    return {
                        code: 400,
                        cont: "ERR: unidentified error \n" + e
                    }
                });
            } else {
                return {
                    code: 400,
                    cont: "ERR: Invalid payment id: " + paym_id
                };
            }
        } else {
            return {
                code: 400,
                cont: "ERR: Invalid parameter: paymethod"
            };
        }
            
    }

    // // pay serveral times calculator
    // function date_check(basey, basem, based, addsub) {
    //     let date = new Date(basey, basem-1, based, 20);
    //     date.setDate(date.getDate() + addsub);
    //     return date.toLocaleString();
    // }

    // function regularpayMaker(duration) {
    //     const fullDate = getTime().split("-")[0];
    //     const basedate = new Date(fullDate.substr(0, 4), fullDate.substr(4, 2), fullDate.substr(6, 2), 20);
    //     let array = [];
    //     for (var i = 0; i < 12; i++) {
    //         basedate.setDate(basedate.getDate() + duration);
    //         array.push(basedate);
    //     }
    //     // console.log(array);
    //     return array;
    // }

    // app.post('/', (req, res) => {
    //     const res_pwd = regularpayMaker(30);
    //     res.end(res_pwd);
    // })



    // payment functions

    // 0: test
    function payTest(muid, cuid, token, userinfo, res) {
        // pay real. refund money in iamport console

        console.log("=====test pay=====");
        console.log("Token: " + token);
        console.log(expiry);
        
        var birth = userinfo.birth;
        
        while(true) {
            var before = birth;
            birth = birth.replace(".","");
            if (birth == before) {
                if ('' + birth.split("")[0] + birth.split("")[1] == '19') {
                    birth = birth.replace("19","");
                } else {
                    birth = birth.replace("20","");
                }
                break;
            }
        }

        console.log(birth);
        
        const headers = {
            "Content-Type": "application/json",
            "Authorization": token
        }

        const data = {
            merchant_uid: muid,
            amount,
            card_number,
            expiry,
            birth,
            pwd_2digit,
            customer_uid: cuid,
            name: userinfo.name
            // pg: "[PG]"
        }

        axios.post('https://api.iamport.kr/subscribe/payments/onetime', data, {headers})
            .then((res_pay) => {
                console.log("=====pay requested=====");
                // console.log(res_pay.data);
                // res.json(res_pay.data);
                if (res_pay.data.response && res_pay.data.response.status == "paid") {
                    console.log("=====paid!=====");
                    res_end(res, 200, undefined, undefined, {
                        muid,
                        cuid,
                        amount,
                        status: true,
                        userid
                    });
                } else if (res_pay.data.response && res_pay.data.response.status == "failed" && res_pay.data.response.fail_reason.includes("사용한도초과")) {
                    res_end(res, 403, "잔액부족/한도초과", "payOne", undefined,{
                        muid,
                        cuid,
                        amount,
                        status: true,
                        userid
                    });
                } else {
                    if (res_pay.data.response && res_pay.data.response.fail_reason) {
                        res_end(res, 403, res_pay.data.response.fail_reason, "payOne", undefined,{
                            muid,
                            cuid,
                            amount,
                            status: true,
                            userid
                        });
                    } else {
                        res_end(res, 403, res_pay.data, "payOne", undefined,{
                            muid,
                            cuid,
                            amount,
                            status: true,
                            userid
                        });
                    }
                }
            })
            .catch((e) => {
                console.log(e);
                // res.json(e);
                res_end(res, 200, e, "payOne", undefined,{
                    muid,
                    cuid,
                    amount,
                    status: true,
                    userid
                });
            })
    }

    // 1: onetime
    function payOne(muid, cuid, token, userinfo, res, pg) {
        // pay real

        if (server_mode == "development") {
            res_end(res, 501, "ERR: forbidden", "payOne", undefined, "Service Not Opened");
        } else if (server_mode == "service") {
            console.log("=====payOne=====");
            // console.log("Token: " + token);
            // console.log(expiry);
            // console.log(userinfo.birth);
            
            var birth = userinfo.birth;
            
            while(true) {
                var before = birth;
                birth = birth.replace(".","");
                if (birth == before) {
                    if ('' + birth.split("")[0] + birth.split("")[1] == '19') {
                        birth = birth.replace("19","");
                    } else {
                        birth = birth.replace("20","");
                    }
                    break;
                }
            }
            
            const headers = {
                "Content-Type": "application/json",
                "Authorization": token
            }

            const data = {
                merchant_uid: muid,
                amount,
                card_number,
                expiry,
                birth,
                pwd_2digit,
                customer_uid: cuid,
                name: userinfo.name,
                pg
            }

            axios.post('https://api.iamport.kr/subscribe/payments/onetime', data, {headers})
            .then((res_pay) => {
                console.log("=====pay requested=====");
                // console.log(res_pay.data);
                // res.json(res_pay.data);
                if (res_pay.data.response.status == "paid") {
                    res_end(res, 200, undefined, undefined, {
                        muid,
                        cuid,
                        amount,
                        status: true,
                        userid
                    });
                } else if (res_pay.data.response.status == "failed" && res_pay.data.response.fail_reason.includes("사용한도초과")) {
                    res_end(res, 403, "잔액부족/한도초과", "payOne", undefined,{
                        muid,
                        cuid,
                        amount,
                        status: true,
                        userid
                    });
                } else {
                    res_end(res, 403, res_pay.data.response.fail_reason, "payOne", undefined,{
                        muid,
                        cuid,
                        amount,
                        status: true,
                        userid
                    });
                }
            })
            .catch((e) => {
                // console.log(e);
                // res.json(e);
                res_end(res, 200, e, "payOne", undefined,{
                    muid,
                    cuid,
                    amount,
                    status: true,
                    userid
                });
            })
        }
    }

    // 2: subscribe
    function paySubscribe(muid, cuid, token, userinfo, res, pg) {
        // pay real
        // subscribe will be setted 12 times maximum

        if (server_mode == "development") {
            res_end(res, 501, "ERR: forbidden", "payOne", undefined, "Service Not Opened");
        } else if (server_mode == "service") {
            console.log("=====payOne=====");
            // console.log("Token: " + token);
            // console.log(expiry);
            // console.log(userinfo.birth);
            
            var birth = userinfo.birth;
            
            while(true) {
                var before = birth;
                birth = birth.replace(".","");
                if (birth == before) {
                    if ('' + birth.split("")[0] + birth.split("")[1] == '19') {
                        birth = birth.replace("19","");
                    } else {
                        birth = birth.replace("20","");
                    }
                    break;
                }
            }
            
            const headers = {
                "Content-Type": "application/json",
                "Authorization": token
            }

            const data = {
                // merchant_uid: muid,
                // amount,
                // card_number,
                // expiry,
                // birth,
                // pwd_2digit,
                // customer_uid: cuid,
                // name: userinfo.name,
                // pg
                customer_uid: cuid,

            }

            axios.post('https://api.iamport.kr/subscribe/payments/schedules', data, {headers})
            .then((res_pay) => {
                console.log("=====pay requested=====");
                // console.log(res_pay.data);
                // res.json(res_pay.data);
                if (res_pay.data.response.status == "paid") {
                    res_end(res, 200, undefined, undefined, {
                        muid,
                        cuid,
                        amount,
                        status: true,
                        userid
                    });
                } else if (res_pay.data.response.status == "failed" && res_pay.data.response.fail_reason.includes("사용한도초과")) {
                    res_end(res, 403, "잔액부족/한도초과", "payOne", undefined,{
                        muid,
                        cuid,
                        amount,
                        status: true,
                        userid
                    });
                } else {
                    res_end(res, 403, res_pay.data.response.fail_reason, "payOne", undefined,{
                        muid,
                        cuid,
                        amount,
                        status: true,
                        userid
                    });
                }
            })
            .catch((e) => {
                // console.log(e);
                // res.json(e);
                res_end(res, 200, e, "payOne", undefined,{
                    muid,
                    cuid,
                    amount,
                    status: true,
                    userid
                });
            })
        }
    }



    app.post('/card', (req, res) => {
        const type = req.body.paytype; // 0: test, 1: onetime, 2: subscribe

        const card_number = req.body.card_num; // 16-digit card number
        const expiry = req.body.expiry; // YYYY-MM
        const pwd_2digit = req.body.pwd; // first 2-digit card password
        const amount = req.body.amount; // paying amount (Base: Korean WON)
        const userid = req.body.userid; // format: String

        const pay_duration = req.body.payDur; // format: YYYY-MM-DD

        // new Date('2012.08.10').getTime() / 1000


        // payment function

            
            
    })






module.exports = app;