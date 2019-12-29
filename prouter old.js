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


// pay function

        // logger

function payment_logger (paytype, paymethod, methodinfo, date, time, state, ip, interest, Pplan, prodid, pid) {
    // request example

    /*

    log_info: {
        paytype: 0/1/2 // 0: test, 1: onetime, 2: subscribe
        paymethod: 0/1 // 0: card, 1: vbank
        methodinfo: {
            // if (paymehtod == 0)

            cnum: [Full, non-encrypted card number]
            expiry: [YYYY-DD]

            // if (paymethod == 1) 

            accnum_c: [customer account number]
            accnum_v: [vbank account number]
            bcode_c: [customer account bankcode]
            bcode_v: [vbank account bankcode]
            
        }

        date: [YYYYDDMM]
        time: [HH:MM:SS]
        state: 0/1/2/3/4/5 // 0: payment requested, 1: payment progressing (only for card), 2: payment complete, 3: vbank error (only for vbank), 4: card error (only for card) (include bank managing time), 5: payment canceled
        ip: [___.___.___.___]
        interest: 1~12 (interest only be settled bigger than '1' if paying price is more than 50,000WON (KRW))

    }

    */

    // request example
}



        // request
        app.post('/payment', (req, res) => {
            const type = req.body.paytype; // 0: test, 1: onetime, 2: subscribe

            const card_number = req.body.card_num; // 16-digit card number
            const expiry = req.body.expiry; // YYYY-MM
            const pwd_2digit = req.body.pwd; // first 2-digit card password
            const amount = req.body.amount; // paying amount (Base: Korean WON)
            const userid = req.body.userid; // format: String

            // payment functions

            
            function payTest(muid, cuid, token, userinfo, res) {
                // pay real, and refund after a minute

                console.log("=====test pay=====");
                console.log("Token: " + token);
                console.log(expiry);
                
                var birth = userinfo.birth;
                
                while(true) {
                    var before = birth;
                    birth = birth.replace(".","");
                    if (birth == before) {
                        birth = birth.replace("19","");
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



            // payment functions

            async.waterfall([
                function(callback) {
                    // get paying request information
                    fs.readFile(__dirname + "/paymentRInfo.json", {encoding: "UTF-8"}, (err, data) => {
                        if (err) res_end(res, 400, err, "Read paymentRInfo", undefined);
                        else callback(null, JSON.parse(data));
                        // res.end();
                    })
                },
                function(paymentRInfo, callback) {
                    // get user information
                    mysql_query("SELECT * FROM user WHERE userid='" + userid + "'")
                    .then((res_sql) => {
                        // console.log(res_sql);
                        if (res_sql.length == 0) res_end(res, 404, "ERR: Cannot find user '" + userid + "'", "check userid", undefined);
                        else callback(null, paymentRInfo, res_sql[0]);
                    })
                },
                function(paymentRInfo, userinfo, callback) {
                    // console.log(".");

                    // get AccessToken

                    axios.post('https://api.iamport.kr/users/getToken', {
                        imp_key: paymentRInfo.apiKey,
                        imp_secret: paymentRInfo.apiSecret
                    })
                    .then((res) => {
                        // console.log(".");
                        const data = res.data;
                        if (data.response.access_token) {
                            // console.log(".");
                            callback(null, data.response.access_token, userinfo);
                        } else {
                            res_end(res, 400, "ERR: Authorification Failed in Internal Server. Please Contact Server Manager", "getAccessToken", undefined, res);
                        }
                    })
                    .catch((e) => {
                        if (e.response && e.response.status == 401) {
                            res_end(res, 401, "ERR: Authorification Failed in Official Payment API Server.", "getAccessToken", undefined);
                        }
                    })
                },
                function(token, userinfo, callback) {

                    console.log(".");

                    // generate customer uid

                    const fullTime = getTime();
                    console.log(fullTime);
                    const date = fullTime.split("-")[0];
                    const time = fullTime.split("-")[1];
                    const timeadd = (time.split(":")[0])*1 + (time.split(":")[1])*1 + (time.split(":")[2])*1;
                    console.log(timeadd);

                    const cuid_back = (userinfo._id)*1 + (userinfo.pn)*1 + (userinfo.birth.split(".")[1])*1 + (userinfo.birth.split(".")[0])*1;
                    console.log(userinfo);
                    console.log(cuid_back);
                    const customer_uid = '' + userid + cuid_back;
                    console.log(customer_uid);


                    // generate merchant uid

                    const merchant_uid = date + "_" + userid + timeadd + makeid(5);

                    console.log(customer_uid);
                    console.log(merchant_uid);


                    callback(null, merchant_uid, customer_uid, token, userinfo);
                },
                function(muid, cuid, token, userinfo, callback) {

                    console.log("before request");

                    // distinguish paytype
                    if (type == "0") {
                        // test payment
                        payTest(muid, cuid, token, userinfo, res);
                    } else if (type == "1") {
                        payOne(muid, cuid, token, userinfo, res, req.body.pg);
                    } else if (type == "2") {
                        paySchedule(muid, cuid, token, userinfo, res);
                    }
                }
            ])
        })

        // cancel

        // find (load logs)



module.exports = app;