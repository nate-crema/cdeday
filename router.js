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

mysql_query("show tables")
.then((res) => {
    if (res.length != 0) {
        console.log("Connected to Mysql DB. Total table number is " + res.length);
    }
})
.catch((err) => {
    console.log(err);
})


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


// Authorizing - pass this method before start other functions


// reservation function

    // create

    app.post('/reserv', (req, res) => {
        const datetime = req.body.time // format example : YYYYMMDD-HH:MM (reservation time)
        const user_id = req.body.id // format: String (reservated user id)
        var status = 0; // format: Number(1) (0: reservation complete, 1: chat ready, 2: progressing, 3: pause, 4: complete)
        const dsg_id = req.body.designer_id // format: String (designer id)
        const note = req.body.note; // format: String (reservating memo)
        const photo = req.body.photo; // format: Array


        // max connectable number of designer per an hour
        const maxconn = 4;

        const datetime_split = datetime.split("-");
        const date = datetime_split[0];
        const time = datetime_split[1];


        async.waterfall([
            function(callback) {
                // load previous reservation log (all)

                mysql_query('select *FROM reserv')
                .then((res) => {
                    // console.log(res);
                    callback(null, res);
                })
                .catch((err) => {
                    console.log("ERR" + err);
                    if (err) res_end(res, 500, err, "load previous reservation log(all)", undefined);
                })
            },
            function(dbdata, callback) {
                // load previous reservation log (requested designer)

                mysql_query('select *FROM reserv WHERE designerid="' + dsg_id + '"')
                .then((res) => {
                    callback(null, dbdata, res);
                })
                .catch((err) => {
                    console.log("ERR" + err);
                    res_end(res, 500, err, "load previous reservation log(designer)", undefined);
                })
            },
            function(dbdata_origin, dbdata_designer, callback) {
                // check maximum member exceed
                const datefilter = dbdata_designer.filter(data => {
                    return data.date == date;
                })
                const timefilter = datefilter.filter(data => {
                    return data.time == time;
                })
                const userfilter = timefilter.filter(data => {
                    return data.userid == user_id;
                })

                if (timefilter.length >= maxconn) {
                    res_end(res, 403, "ERR: designer's max time limitation exceed.", "maximum member exceed", undefined);
                } else if (userfilter.length != 0) { 
                    res_end(res, 403, "ERR: Already reserved user.", "maximum member exceed", undefined);
                } else {
                    callback(null, dbdata_origin, dbdata_designer);
                }
            },
            function(dbdata_origin, dbdata_designer, callback) {
                // add data to db
                var command = 'INSERT INTO reserv (userid, status, designerid, date, time, note, photoid) VALUES("' + user_id + '", ' + status + ', "' + dsg_id + '", "' + date + '", "' + time + '", "' + note + '", "' + photo + '")';
                if (note == undefined) {
                    command.replace('", "' + note , '');
                }
                if (photo == undefined) {
                    command.replace('", "' + photo , '');
                }
                mysql_query(command)
                .then((res_sql) => {
                    console.log(res_sql);
                    res_end(res, 200, undefined, undefined, "true");
                })
                .catch((err) => {
                    console.log("ERR" + err);
                    if (err) res_end(res, 500, err, "db write", undefined);
                })
            }

        ])
    })

    // update

    app.patch('/reserv', (req, res) => {
        const base = req.body.base; // format: JSON
        const cobj = req.body.data; // format: JSON

        var ucomm = "";

        // filtering rules
            if (cobj.id) {
                ucomm += ', id="'+cobj.id+'"'
            }
            if (cobj.userid) {
                ucomm += ', userid="'+cobj.userid+'"'
            }
            if (cobj.status) {
                ucomm += ', status="'+cobj.status+'"'
            }
            if (cobj.designerid) {
                ucomm += ', designerid="'+cobj.designerid+'"'
            }
            if (cobj.date) {
                ucomm += ', date="'+cobj.date+'"'
            }
            if (cobj.time) {
                ucomm += ', time="'+cobj.time+'"'
            }
            if (cobj.note) {
                ucomm += ', note="'+cobj.note+'"'
            }
        // filtering rules

        var scomm = "";

        // filtering bases
        if (base != undefined) {
            if (base != "all") {
                if (base.id) {
                    scomm += ' AND id="'+base.id+'"'
                }
                if (base.userid) {
                    scomm += ' AND userid="'+base.userid+'"'
                }
                if (base.status) {
                    scomm += ' AND status="'+base.status+'"'
                }
                if (base.designerid) {
                    scomm += ' AND designerid="'+base.designerid+'"'
                }
                if (base.date) {
                    scomm += ' AND date="'+base.date+'"'
                }
                if (base.time) {
                    scomm += ' AND time="'+base.time+'"'
                }
                if (base.note) {
                    scomm += ' AND note="'+base.note+'"'
                }
            }
        }
        

        // filtering bases

        ucomm = ucomm.replace(",", "");
        scomm = scomm.replace(" AND", " WHERE");

        const cbase = Object.keys(base)[0];
        mysql_query("UPDATE reserv SET" + ucomm + scomm)
        .then((res_sql) => {
            // console.log(res_sql);
            res_end(res, 200, undefined, undefined, res_sql);
        })
        .catch((err) => {
            // console.log(err);
            res_end(res, 403, err, "Search from DB", undefined);
        })

    })

    // read

    app.get('/reserv', (req, res) => {
        const rule = req.body.rule; // format: String or JSON

        var scomm = "";

        // filtering rules
        if (rule != undefined) {
            if (rule != "all") {
                if (rule.id) {
                    scomm += ' AND id="'+rule.id+'"'
                }
                if (rule.userid) {
                    scomm += ' AND userid="'+rule.userid+'"'
                }
                if (rule.status) {
                    scomm += ' AND status="'+rule.status+'"'
                }
                if (rule.designerid) {
                    scomm += ' AND designerid="'+rule.designerid+'"'
                }
                if (rule.date) {
                    scomm += ' AND date="'+rule.date+'"'
                }
                if (rule.time) {
                    scomm += ' AND time="'+rule.time+'"'
                }
                if (rule.note) {
                    scomm += ' AND note="'+rule.note+'"'
                }
            }
            

            // filtering rules

            scomm = scomm.replace(" AND", " WHERE");

            // console.log(scomm);

            mysql_query("SELECT * FROM reserv" + scomm)
            .then((res_sql) => {
                // console.log(res_sql);
                res_end(res, 200, undefined, undefined, res_sql);
            })
            .catch((err) => {
                // console.log(err);
                res_end(res, 403, err, "Search from DB", undefined);
            })
        } else {
            res_end(res, 400, "Cannot find key 'rule'", "Filtering Convertion", undefined);
        }
    })

    // delete

    app.delete('/reserv', (req, res) => {
        const rule = req.body.rule; // format: String or JSON

        var scomm = "";

        // filtering rules
        if (rule != undefined) {
            if (rule != "all") {
                if (rule.id) {
                    scomm += ' AND id="'+rule.id+'"'
                }
                if (rule.userid) {
                    scomm += ' AND userid="'+rule.userid+'"'
                }
                if (rule.status) {
                    scomm += ' AND status="'+rule.status+'"'
                }
                if (rule.designerid) {
                    scomm += ' AND designerid="'+rule.designerid+'"'
                }
                if (rule.date) {
                    scomm += ' AND date="'+rule.date+'"'
                }
                if (rule.time) {
                    scomm += ' AND time="'+rule.time+'"'
                }
                if (rule.note) {
                    scomm += ' AND note="'+rule.note+'"'
                }
            }
            

            // filtering rules

            scomm = scomm.replace(" AND", " WHERE");

            // console.log(scomm);

            mysql_query("DELETE FROM reserv" + scomm)
            .then((res_sql) => {
                // console.log(res_sql);
                res_end(res, 200, undefined, undefined, res_sql);
            })
            .catch((err) => {
                // console.log(err);
                res_end(res, 403, err, "Delete from DB", undefined);
            })
        } else {
            res_end(res, 400, "Cannot find key 'rule'", "Filtering Convertion", undefined);
        }
    })



    // photo upload function

        const upload = multer ({
            storage: multer.diskStorage({
                destination: (req, file, cb) => {
                    cb(null, path.join(__dirname, '/photo/tmp'))
                },
                filename: (req, file, cb) => {
                    const baseFileName = file.fieldname + "-" + Date.now();

                    function check_file(baseFileName) {
                        if (fs.existsSync(baseFileName)) return check_file(baseFileName+"(1)");
                        else return cb(null, baseFileName);
                    }

                    check_file(baseFileName);
                }
            })
        })

        // upload
        app.post('/photo_u', upload.any(), (req, res) => {
            const files = req.files[0];
            const uploader = req.body.userid;
            const uploadtime = getTime();

            
            // res.end();
            
            if (req.files.length > 1) {
                res_end(res, 413, "ERR: CANNOT UPLOAD MULTIPLE FILES AT ONCE", "check file number", undefined);
            } else {
                async.waterfall([
                    function(callback) {
                        // console.log(files);

                        // create photoid

                        const random_fdigit = makeid(5);

                        var photoid = uploadtime + "%#$" + random_fdigit + "uid" + uploader + Date.now();
                        photoid = crypto.createHash('sha512').update(photoid).digest('base64').replace("==", "");
                        // console.log(photoid);
                        
                        // create filename

                        const fileTmpDir = files.destination;
                        const fileTmpSaved = files.path;
                        const fileTmpName = files.filename;
                        const filename_split = files.originalname.split(".");
                        const fileExt = filename_split[filename_split.length-1];
                        const fileOriginName = files.originalname.replace(fileExt, "").replace(".","");
                        

                        // const fileSaveName = crypto.createHash('sha512').update(fileOriginName).digest('base64');


                        const cipher_fsN = crypto.createCipher('aes-256-cbc', photoid);
                        let fileSaveName = cipher_fsN.update(fileOriginName, 'utf8', 'base64');
                        fileSaveName += cipher_fsN.final('base64');


                        // remove '/' because of route error possibility

                        while (true) {
                            var before = fileSaveName;
                            fileSaveName = before.replace("/","");
                            if (before == fileSaveName) break;
                        }

                        // move file to user folder

                        const newSaveDir = path.join(__dirname, "/photo/" + uploader);

                        
                        if (!fs.existsSync(newSaveDir)) {
                            fs.mkdirSync(newSaveDir);
                        }

                        // console.log(fs.existsSync(fileTmpSaved));
                        // console.log(fs.existsSync(path.join(newSaveDir, fileSaveName)));
                        // console.log(fs.existsSync(newSaveDir));

                        fs.rename(fileTmpSaved, path.join(newSaveDir, fileSaveName + "." + fileExt), (err) => {
                            if (err) res_end(res, 400, err, "move tmp to psersonal", undefined);
                            else {
                                callback(null, {
                                    ext: fileExt,
                                    route: newSaveDir,
                                    savename: fileSaveName,
                                    originalname: fileOriginName
                                }, photoid, uploadtime, uploader);
                            }
                        });

                        // res.end();
                    },
                    function(fileinfo, photoid, time, uploader, callback) {
                        // duplicate uplodaed file check

                        mysql_query("SELECT * FROM photo WHERE savedname='" + fileinfo.savename + "'")
                        .then((res_sql) => {
                            // console.log(res_sql);
                            if (res_sql.length > 0) {
                                res_end(res, 403, "ERR: Already uploaded file", "check file duplication", undefined); 
                            } else {
                                callback(null, fileinfo, photoid, time, uploader);
                            }
                        })
                    },
                    function(fileinfo, photoid, time, uploader, callback) {
                        // save info in DB

                        const command = "INSERT INTO photo (photoid, filename, ext, savedname, date, time, uploader, ip) VALUES('" + photoid + "', '" + fileinfo.originalname + "', '" + fileinfo.ext + "', '" + fileinfo.savename + "', '" + time.split("-")[0] + "', '" + time.split("-")[1] + "', '" +  uploader + "', '" + getIP(req).clientIp + "');";
                        // console.log(command);
                        mysql_query(command)
                        .then((res_sql) => {
                            // console.log(res_sql);
                            // res.end();
                            res_end(res, 200, undefined, undefined, "true");
                        })
                        .catch((e) => {
                            // console.log(e);
                            res_end(res, 403, e, "writing info - DB", undefined, command);
                        })
                    }
                ])
            }
        })

        // download
        app.post('/photo_d', (req, res) => {
            const photoid = req.body.photoid;

            if (!photoid) res_end(res, 400, "Cannot find key 'photoid'", "check photoid", undefined);
            else {
                mysql_query("SELECT * FROM photo WHERE photoid='" + photoid + "'")
                .then((res_sql) => {
                    if (res_sql.length == 0) res_end(res, 404, "FILE NOT FOUND", "query request", undefined);
                    else if (res_sql.length > 1) res_end(res, 413, "batchSizeTooLarge", "query request", undefined, "server error: contact manager");
                    else {
                        const savedfile = res_sql[0];
                        const fileName = savedfile.filename;
                        const savedFileRoute = path.join(__dirname, "/photo/" + savedfile.uploader, savedfile.savedname);
                        const mimetype = mimeTypes.lookup(savedFileRoute + "." + savedfile.ext);
                        res.setHeader('Content-disposition', 'attachment; filename=' + fileName + "." + savedfile.ext);
                        res.setHeader('Content-type', mimetype);
                        fs.createReadStream(savedFileRoute).pipe(res);
                    }
                })
                .catch((e) => {
                    console.log(e);
                    res_end(res, 400, e, "query request", undefined);
                })
            }
        })

        // load(web)
        app.get('/photo_w', (req, res) => {
            const photoname = req.url.split("?photoname=")[1];
            // console.log(photoname);

            if (!photoname) res_end(res, 400, "Cannot find key 'photoname'", "check photoname", undefined);
            else {
                mysql_query("SELECT * FROM photo WHERE photoid='" + photoname + "'")
                .then((res_sql) => {
                    if (res_sql.length == 0) res_end(res, 404, "FILE NOT FOUND", "query request", undefined);
                    else if (res_sql.length > 1) res_end(res, 413, "batchSizeTooLarge", "query request", undefined, "server error: contact manager");
                    else {
                        const savedfile = res_sql[0];
                        const savedFileRoute = path.join(__dirname, "/photo/" + savedfile.uploader, savedfile.savedname + "." + savedfile.ext);
                        fs.createReadStream(savedFileRoute).pipe(res);
                    }
                })
                .catch((e) => {
                    console.log(e);
                    res_end(res, 400, e, "query request", undefined);
                })
            }
            
        })

        // list
        app.get('/photo_l', (req, res) => {
            const photoid = req.body.photoid;

            if (!photoid) res_end(res, 400, "Cannot find key 'photoid'", "check photoid", undefined);
            
            mysql_query("SELECT * FROM photo WHERE photoid='" + photoid + "'")
            .then((res_sql) => {
                res_end(res, 200, undefined, undefined, res_sql);
            })
            .catch((e) => {
                res_end(res, 400, e, "query request", undefined);
            })
        })

    // photo upload function


// reservation function


// user function

    // create
    app.post('/user', (req, res) => {
        const userid = req.body.userid;
        const pw = req.body.pw;
        const type = req.body.type; // format: int(1) || 0: finance manager, 1: user, 2: designer, 3: system manager, 4: Administrator, 5: test account
        const name = req.body.name;
        const pn = req.body.pn;
        const email = req.body.email;
        const birth = req.body.birth;

        if (!userid || !pw || !type || !name || !pn || !email || !birth) {
            res_end(res, 400, "Some of Information Expected, but missed.", "Checking input data", undefined);
        } else {
            async.waterfall([
                function(callback) {
                    // userid duplication check
                    mysql_query("SELECT * FROM user WHERE userid='" + userid + "'")
                    .then((res_sql) => {
                        if (res_sql.length != 0) {
                            res_end(res, 409, "ERR: Duplicate userid", "userid duplication check", undefined);
                        } else {
                            callback(null);
                        }
                    })
                    .catch((e) => {
                        console.log(e);
                        res_end(res, 400, e, "userid duplication check", undefined);
                    })
                },
                function(callback) {
                    // password encrypt

                    crypto.randomBytes(64, (err, buf) => {
                        crypto.pbkdf2(pw, buf.toString('base64'), 150000, 70, 'sha512', (err, key) => {
                            // console.log(key.toString('base64')); 
                            // console.log(key.toString('base64').length);
                            // console.log(buf.toString('base64').length);
                            callback(null, key.toString('base64'), buf.toString('base64'));
                        });
                    });
                },
                function(pw_enc, salt, callback) {
                    // register user
                    mysql_query("INSERT INTO user (userid, pw, type, name, pn, email, birth, salt) VALUES ('" + userid + "', '" + pw_enc + "', " + type + ", '" + name + "', '" + pn + "', '" + email + "', '" + birth + "', '" + salt + "');")
                    .then((res_sql) => {
                        console.log(res_sql);
                        res_end(res, 200, undefined, undefined, "true");
                    })
                    .catch((e) => {
                        res_end(res, 400, e, "register user", undefined);
                    })
                }
            ])
        }

        // res.end();
    })

    // update
    app.patch('/user', (req, res) => {
        const base = req.body.base; // format: JSON
        const cobj = req.body.data; // format: JSON

        var ucomm = "";


        var scomm = "";

        // filtering bases/cobj
        if (base != undefined && cobj != undefined) {
                if (cobj.userid) {
                    ucomm += ', userid="'+cobj.userid+'"'
                }
                if (cobj.name) {
                    ucomm += ', name="'+cobj.name+'"'
                }
                if (cobj.type) {
                    ucomm += ', type="'+cobj.type+'"'
                }
                if (cobj.pn) {
                    ucomm += ', pn="'+cobj.pn+'"'
                }
                if (cobj.email) {
                    ucomm += ', eamil="'+cobj.email+'"'
                }
            if (base != "all") {
                if (base.userid) {
                    scomm += ' AND userid="'+base.userid+'"'
                }
                if (base.name) {
                    scomm += ' AND name="'+base.name+'"'
                }
                if (base.type) {
                    scomm += ' AND type="'+base.type+'"'
                }
                if (base.pn) {
                    scomm += ' AND pn="'+base.pn+'"'
                }
                if (base.email) {
                    scomm += ' AND email="'+base.email+'"'
                }
            }
        }
        // filtering bases/cobj

        ucomm = ucomm.replace(",", "");
        scomm = scomm.replace(" AND", " WHERE");

        // const cbase = Object.keys(base)[0];
        const command = "UPDATE user SET" + ucomm + scomm;
        console.log(command);
        mysql_query(command)
        .then((res_sql) => {
            // console.log(res_sql);
            res_end(res, 200, undefined, undefined, res_sql);
        })
        .catch((err) => {
            // console.log(err);
            res_end(res, 403, err, "Search from DB", undefined, scomm + "\n" + ucomm);
        })
    })
    

    // read
    app.get('/user', (req, res) => {
        const rule = req.body.rule; // format: String or JSON

        var scomm = "";

        // filtering rules
        if (rule != undefined) {
            if (rule != "all") {
                if (rule.userid) {
                    scomm += ' AND userid="'+rule.userid+'"'
                }
                if (rule.name) {
                    scomm += ' AND name="'+rule.name+'"'
                }
                if (rule.type) {
                    scomm += ' AND type="'+rule.type+'"'
                }
                if (rule.pn) {
                    scomm += ' AND pn="'+rule.pn+'"'
                }
                if (rule.email) {
                    scomm += ' AND email="'+rule.eamil+'"'
                }
            }
            

            // filtering rules

            scomm = scomm.replace(" AND", " WHERE");

            // console.log(scomm);

            mysql_query("SELECT * FROM user" + scomm)
            .then((res_sql) => {
                // console.log(res_sql);
                res_end(res, 200, undefined, undefined, res_sql);
            })
            .catch((err) => {
                // console.log(err);
                res_end(res, 403, err, "Search from DB", undefined);
            })
        } else {
            res_end(res, 400, "Cannot find key 'rule'", "Filtering Convertion", undefined);
        }
    })

    // delete
    app.delete('/user', (req, res) => {
        const rule = req.body.rule; // format: String or JSON

        var scomm = "";

        // filtering rules
        if (rule != undefined) {
            if (rule != "all") {
                if (rule.userid) {
                    scomm += ' AND userid="'+rule.userid+'"'
                }
                if (rule.name) {
                    scomm += ' AND name="'+rule.name+'"'
                }
                if (rule.type) {
                    scomm += ' AND type="'+rule.type+'"'
                }
                if (rule.pn) {
                    scomm += ' AND pn="'+rule.pn+'"'
                }
                if (rule.email) {
                    scomm += ' AND email="'+rule.email+'"'
                }
            }
            

            // filtering rules

            scomm = scomm.replace(" AND", " WHERE");

            // console.log(scomm);

            mysql_query("DELETE FROM user" + scomm)
            .then((res_sql) => {
                // console.log(res_sql);
                res_end(res, 200, undefined, undefined, res_sql);
            })
            .catch((err) => {
                // console.log(err);
                res_end(res, 403, err, "Delete from DB", undefined);
            })
        } else {
            res_end(res, 400, "Cannot find key 'rule'", "Filtering Convertion", undefined);
        }
    })

// user function


// community function

    // post function

        // create
        app.post('/post', (req, res) => {
            const userid = req.body.userid; // format: String (50)
            const photoid = req.body.photoid; // format: Array
            const title = req.body.title; // format: String (50)
            const cont = req.body.cont; // format: String(3000)


            const T_time = getTime();
            const date = T_time.split("-")[0];
            const time = T_time.split("-")[1];
            const ip = getIP(req).clientIp;
            
            // make postid

            var postid = 'N' + 527 + makeid(6, "num"); // postid: N527______ (N527: fixed postid identification code, _______: additional random 6digit number)

            var tried = 0;
            function check_postid (pid) {
                return new Promise((resolve, reject) => {
                    mysql_query("SELECT * FROM post WHERE postid='" + pid + "'")
                    .then((res_sql) => {
                        // console.log(res_sql);
                        // console.log(res_sql.length);
                        if (res_sql.length > 0 && tried < 100) {
                            // console.log(tried);
                            postid = '' + 527 + makeid(7, "num");
                            tried++;
                            resolve(check_postid(postid));
                        } else if (tried >= 100) {
                            resolve(false);
                        } else {
                            // console.log("not duplicate");
                            resolve(true);
                        }
                    })
                    .catch((e) => {
                        reject(e);
                    })
                })
                
            }


            // write information
            async.waterfall([
                function(callback) {
                    // user verification
                    
                    mysql_query("SELECT * FROM user WHERE userid='" + userid + "'")
                    .then((res_sql) => {
                        if (res_sql.length == 1) {
                            callback(null);
                        } else if (res_sql.length > 1) {
                            res_end(res, 400, "ERR: duplicate user id", "user verification", undefined, res_sql);
                        } else {
                            res_end(res, 404, "ERR: Cannot find user: " + userid, "user verification", undefined);
                        }
                    })
                    .catch((e) => {
                        res_end(res, 404, e, "user verification", undefined, "error while request sql \n res: " + res_sql);
                    })
                },
                function(callback) {
                    // check postid duplication
                    check_postid(postid)
                    .then((res_check) => {
                        // console.log(res_check);
                        if (res_check == true) {
                            callback(null);   
                        } else {
                            res_end(res, 400, "ERR: creating postid failed", "check postid", undefined);
                        }
                    })
                },
                function(callback) {
                    // photoid length check
                    if (photoid.toString.lenght > 10000) {
                        res_end(res, 705, "ERR: Image attachment length exceed", "check image exceed", undefined);
                    } else {
                        callback(null);
                    }

                    
                },
                function (callback) {
                    // title length check
                    const check_title = title.length > 50;
                    // console.log(check_title);
                    if (check_title) {
                        console.log("non-checked!");
                        res_end(res, 705, "ERR: 'title' length exceed", "check title exceed");
                    } else {
                        console.log("checked!");
                        callback(null);
                    }
                },
                function (callback) {
                    const check_cont = cont.length > 3000;
                    
                    console.log(check_cont);
                    if (check_cont) {
                        res_end(res, 705, "ERR: 'cont' length exceed", "check contents exceed");
                    } else {
                        callback(null);
                    }
                },
                function(callback) {
                    // console.log(postid);
                    // console.log(postid.length);
                    // console.log(photoid);
                    var command = 'INSERT INTO post (userid, date, time, ip, postid, photoid, title, cont) VALUES("' + userid + '", "' + date + '", "' + time + '", "' + ip + '", "' + postid + '", "' + photoid + '", "' + title + '", "' + cont + '")';
                    console.log(command);
                    mysql_query(command)
                    .then((res_sql) => {
                        console.log(res_sql);
                        res_end(res, 200, undefined, undefined, res_sql);
                    })
                    .catch ((e) => {
                        res_end(res, 400, e, "db write", undefined);
                    })
                }
            ])
        })

        // update
        app.patch('/post', (req, res) => {
            const base = req.body.base; // format: JSON
            const cobj = req.body.data; // format: JSON

            var ucomm = "";
            var scomm = "";

            // filtering bases/cobj
            if (base != undefined && cobj != undefined) {
                    if (cobj.title) {
                        ucomm += ', title="'+cobj.title+'"';
                    }
                    if (cobj.cont) {
                        ucomm += ', cont="'+cobj.cont+'"';
                    }
                    if (cobj.photoid) {
                        ucomm += ', photoid="'+cobj.photoid+'"';
                    }
                    if (cobj.commid) {
                        ucomm += ', commid="'+cobj.commid+'"';
                    }
                if (base != "all") {
                    if (base.userid) {
                        scomm += ' AND userid="'+cobj.userid+'"'
                    }
                    if (base.ip) {
                        scomm += ' AND ip="'+cobj.ip+'"'
                    }
                    if (base.postid) {
                        scomm += ' AND postid="'+cobj.postid+'"'
                    }
                    if (base.title) {
                        scomm += ' AND title="'+cobj.title+'"'
                    }
                }
            }
            // filtering bases/cobj

            ucomm = ucomm.replace(",", "");
            scomm = scomm.replace(" AND", " WHERE");

            // const cbase = Object.keys(base)[0];
            mysql_query("UPDATE post SET" + ucomm + scomm)
            .then((res_sql) => {
                // console.log(res_sql);
                res_end(res, 200, undefined, undefined, res_sql);
            })
            .catch((err) => {
                // console.log(err);
                if (err.includes("ER_DATA_TOO_LONG: Data too long for column 'cont'")) {
                    res_end(res, 705, "ERR: 'cont' length exceed", "check cont exceed");
                } else if (err.includes("ER_DATA_TOO_LONG: Data too long for column 'title'")) {
                    res_end(res, 705, "ERR: 'title' length exceed", "check title exceed");
                } else {
                    res_end(res, 403, err, "Search from DB", undefined, scomm + "\n" + ucomm);
                }
            })
        })

        // read
        app.get('/post', (req, res) => {
            const rule = req.body.rule; // format: String or JSON

            var scomm = "";

            // filtering rules
            if (rule != undefined) {
                if (rule != "all") {
                    if (rule.userid) {
                        scomm += ' AND userid="'+cobj.userid+'"'
                    }
                    if (rule.ip) {
                        scomm += ' AND ip="'+cobj.ip+'"'
                    }
                    if (rule.postid) {
                        scomm += ' AND postid="'+cobj.postid+'"'
                    }
                    if (rule.title) {
                        scomm += ' AND title="'+cobj.title+'"'
                    }
                }
                

                // filtering rules

                scomm = scomm.replace(" AND", " WHERE");

                // console.log(scomm);

                mysql_query("SELECT * FROM post" + scomm)
                .then((res_sql) => {
                    // console.log(res_sql);
                    res_end(res, 200, undefined, undefined, res_sql);
                })
                .catch((err) => {
                    // console.log(err);
                    res_end(res, 403, err, "Search from DB", undefined);
                })
            } else {
                res_end(res, 400, "Cannot find key 'rule'", "Filtering Convertion", undefined);
            }
        })

        // delete
        app.delete('/post', (req, res) => {
            const rule = req.body.rule; // format: String or JSON

            var scomm = "";

            // filtering rules
            if (rule != undefined) {
                if (rule != "all") {
                    if (rule.userid) {
                        scomm += ' AND userid="'+cobj.userid+'"'
                    }
                    if (rule.ip) {
                        scomm += ' AND ip="'+cobj.ip+'"'
                    }
                    if (rule.postid) {
                        scomm += ' AND postid="'+cobj.postid+'"'
                    }
                    if (rule.title) {
                        scomm += ' AND title="'+cobj.title+'"'
                    }
                }
                

                // filtering rules

                scomm = scomm.replace(" AND", " WHERE");

                // console.log(scomm);

                mysql_query("DELETE FROM post" + scomm)
                .then((res_sql) => {
                    // console.log(res_sql);
                    res_end(res, 200, undefined, undefined, res_sql);
                })
                .catch((err) => {
                    // console.log(err);
                    res_end(res, 403, err, "Delete from DB", undefined);
                })
            } else {
                res_end(res, 400, "Cannot find key 'rule'", "Filtering Convertion", undefined);
            }
        })

    // comment function

        // create
        app.post('/comment', (req, res) => {
            const userid = req.body.userid;
            const postid = req.body.postid;
            const title = req.body.title;
            const cont = req.body.cont;
            const photoid = req.body.photoid;
            
            
            const totalTime = getTime().split("-");
            const date = totalTime[0];
            const time = totalTime[1];
            const ip = getIP(req).clientIP;
            
            // make commid

            var commid = 'N' + 524 + makeid(6, "num");

            var tried_c = 0;
            function check_commid (cid) {
                return new Promise((resolve, reject) => {
                    mysql_query("SELECT * FROM comment WHERE commid='" + cid + "'")
                    .then((res_sql) => {
                        // console.log(res_sql);
                        // console.log(res_sql.length);
                        if (res_sql.length > 0 && tried_c < 100) {
                            // console.log(tried);
                            commid = '' + 527 + makeid(7, "num");
                            tried_c++;
                            resolve(check_postid(commid));
                        } else if (tried_c >= 100) {
                            resolve(false);
                        } else {
                            // console.log("not duplicate");
                            resolve(true);
                        }
                    })
                    .catch((e) => {
                        reject(e);
                    })
                })
                
            }

            // write information
            async.waterfall([
                function(callback) {
                    // user verification
                    
                    mysql_query("SELECT * FROM user WHERE userid='" + userid + "'")
                    .then((res_sql) => {
                        if (res_sql.length == 1) {
                            callback(null);
                        } else if (res_sql.length > 1) {
                            res_end(res, 400, "ERR: duplicate user id", "user verification", undefined, res_sql);
                        } else {
                            res_end(res, 404, "ERR: Cannot find user: " + userid, "user verification", undefined);
                        }
                    })
                    .catch((e) => {
                        res_end(res, 404, e, "user verification", undefined, "error while request sql \n res: " + res_sql);
                    })
                },
                function(callback) {
                    // check postid duplication
                    check_commid(commid)
                    .then((res_check) => {
                        // console.log(res_check);
                        if (res_check == true) {
                            callback(null);   
                        } else {
                            res_end(res, 400, "ERR: creating commid failed", "check commid", undefined);
                        }
                    })
                },
                function(callback) {
                    // photoid length check
                    if (photoid.toString.lenght > 5000) {
                        res_end(res, 705, "ERR: Image attachment length exceed", "check image exceed", undefined);
                    } else {
                        callback(null);
                    } 
                },
                function (callback) {
                    // title length check
                    const check_title = title.length > 50;
                    // console.log(check_title);
                    if (check_title) {
                        console.log("non-checked!");
                        res_end(res, 705, "ERR: 'title' length exceed", "check title exceed");
                    } else {
                        console.log("checked!");
                        callback(null);
                    }
                },
                function (callback) {
                    const check_cont = cont.length > 1000;
                    
                    console.log(check_cont);
                    if (check_cont) {
                        res_end(res, 705, "ERR: 'cont' length exceed", "check contents exceed");
                    } else {
                        callback(null);
                    }
                },
                function(callback) {
                    // console.log(postid);
                    // console.log(postid.length);
                    // console.log(photoid);
                    var command = 'INSERT INTO comment (userid, date, time, ip, postid, commid, title, cont, photoid) VALUES("' + userid + '", "' + date + '", "' + time + '", "' + ip + '", "' + postid + '", "' + commid + '", "' + title + '", "' + cont + '", "' + photoid + '")';
                    console.log(command);
                    mysql_query(command)
                    .then((res_sql) => {
                        console.log(res_sql);
                        res_end(res, 200, undefined, undefined, res_sql);
                    })
                    .catch ((e) => {
                        res_end(res, 400, e, "db write", undefined);
                    })
                }
            ])

        })
        
        // update
        app.patch('/comment', (req, res) => {
            const base = req.body.base; // format: JSON
            const cobj = req.body.data; // format: JSON

            var ucomm = "";
            var scomm = "";

            // filtering bases/cobj
            if (base != undefined && cobj != undefined) {
                    if (cobj.title) {
                        ucomm += ', title="'+cobj.title+'"';
                    }
                    if (cobj.cont) {
                        ucomm += ', cont="'+cobj.cont+'"';
                    }
                    if (cobj.photoid) {
                        ucomm += ', photoid="'+cobj.photoid+'"';
                    }
                if (base != "all") {
                    if (base.userid) {
                        scomm += ' AND userid="'+cobj.userid+'"'
                    }
                    if (base.ip) {
                        scomm += ' AND ip="'+cobj.ip+'"'
                    }
                    if (base.commid) {
                        scomm += ' AND commid="'+cobj.commid+'"'
                    }
                    if (base.title) {
                        scomm += ' AND title="'+cobj.title+'"'
                    }
                }
            }
            // filtering bases/cobj

            ucomm = ucomm.replace(",", "");
            scomm = scomm.replace(" AND", " WHERE");

            // const cbase = Object.keys(base)[0];
            mysql_query("UPDATE comment SET" + ucomm + scomm)
            .then((res_sql) => {
                // console.log(res_sql);
                res_end(res, 200, undefined, undefined, res_sql);
            })
            .catch((err) => {
                // console.log(err);
                if (err.includes("ER_DATA_TOO_LONG: Data too long for column 'cont'")) {
                    res_end(res, 705, "ERR: 'cont' length exceed", "check cont exceed");
                } else if (err.includes("ER_DATA_TOO_LONG: Data too long for column 'title'")) {
                    res_end(res, 705, "ERR: 'title' length exceed", "check title exceed");
                } else {
                    res_end(res, 403, err, "Search from DB", undefined, scomm + "\n" + ucomm);
                }
            })
        })

        // read
        app.get('/comment', (req, res) => {
            const rule = req.body.rule; // format: String or JSON

            var scomm = "";

            // filtering rules
            if (rule != undefined) {
                if (rule != "all") {
                    if (rule.userid) {
                        scomm += ' AND userid="'+cobj.userid+'"'
                    }
                    if (rule.ip) {
                        scomm += ' AND ip="'+cobj.ip+'"'
                    }
                    if (rule.postid) {
                        scomm += ' AND postid="'+cobj.postid+'"'
                    }
                    if (rule.title) {
                        scomm += ' AND title="'+cobj.title+'"'
                    }
                }
                

                // filtering rules

                scomm = scomm.replace(" AND", " WHERE");

                // console.log(scomm);

                mysql_query("SELECT * FROM comment" + scomm)
                .then((res_sql) => {
                    // console.log(res_sql);
                    res_end(res, 200, undefined, undefined, res_sql);
                })
                .catch((err) => {
                    // console.log(err);
                    res_end(res, 403, err, "Search from DB", undefined);
                })
            } else {
                res_end(res, 400, "Cannot find key 'rule'", "Filtering Convertion", undefined);
            }
        })

        // delete
        app.delete('/comment', (req, res) => {
            const rule = req.body.rule; // format: String or JSON

            var scomm = "";

            // filtering rules
            if (rule != undefined) {
                if (rule != "all") {
                    if (rule.userid) {
                        scomm += ' AND userid="'+cobj.userid+'"'
                    }
                    if (rule.ip) {
                        scomm += ' AND ip="'+cobj.ip+'"'
                    }
                    if (rule.postid) {
                        scomm += ' AND commid="'+cobj.commid+'"'
                    }
                    if (rule.title) {
                        scomm += ' AND title="'+cobj.title+'"'
                    }
                }
                

                // filtering rules

                scomm = scomm.replace(" AND", " WHERE");

                // console.log(scomm);

                mysql_query("DELETE FROM comment" + scomm)
                .then((res_sql) => {
                    // console.log(res_sql);
                    res_end(res, 200, undefined, undefined, res_sql);
                })
                .catch((err) => {
                    // console.log(err);
                    res_end(res, 403, err, "Delete from DB", undefined);
                })
            } else {
                res_end(res, 400, "Cannot find key 'rule'", "Filtering Convertion", undefined);
            }
        })

    // upload function (use with photo upload function)


// community function

// phone authorification api

app.post('/phoneAuth', (req,res) => {
    const pn = req.body.pn // 12-digit KOREA pn
    const userid = req.body.userid; // format: String

})

// phone authorification api


// product information api

    // Create
    app.post('/product', (req, res) => {
        const prodname = req.body.prodname;
        const price = req.body.price; // product price
        const register = req.body.register; // registering request user
        const prodtype = req.body.prodtype; // 0: real product, 1: onetime service product, 2: subscribing service product

        async.waterfall([
            function(callback) {
                // check register validation
                mysql_query("SELECT * FROM USER WHERE userid='" + register + "'")
                .then((res_sql) => {
                    if (res_sql.length == 0) {
                        res_end(res, 404, "ERR: Cannot find user '" + register + "'", "check register validation", undefined);
                    } else if (res_sql[0].type != 4) {
                        res_end(res, 403, "ERR: insufficientPermission", "check register validation", undefined);
                    } else {
                        callback (null);
                    }
                })
            },
            function(callback) {
                // filtering

                if (prodname.length > 50) {
                    res_end(res, 705, "ERR: 'prodname' length exceed", "check prodname exceed");
                } else {
                    callback(null);
                }
            },
            function(callback) {
                // create prodid

                var prodid = Date.now()+makeid(6, "num");
                prodid = "P"+prodid;
                console.log(prodid);
                callback(null, prodid);
            },
            function(prodid, callback) {
                // registser product
                var command = 'INSERT INTO product (prodname, price, register, prodtype, prodid) VALUES("' + prodname + '", ' + price + ', "' + register + '", ' + prodtype + ', "' + prodid + '")';
                console.log(command);
                mysql_query(command)
                .then((res_sql) => {
                    res_end(res, 200, undefined, undefined, "true");
                })
                .catch((e) => {
                    res_end(res, 400, e, "write DB", undefined, "ERROR while registering product");
                })
            }
        ])
    })

    // update
    app.patch('/product', (req, res) => {
        const base = req.body.base; // format: JSON
        const cobj = req.body.data; // format: JSON

        var ucomm = "";
        var scomm = "";

        // filtering bases/cobj
        if (base != undefined && cobj != undefined) {
                if (cobj.prodname) {
                    ucomm += ', prodname="'+cobj.prodname+'"';
                }
                if (cobj.price) {
                    ucomm += ', price="'+cobj.price+'"';
                }
                if (cobj.currency) {
                    ucomm += ', currency="'+cobj.currency+'"';
                }
                if (cobj.note) {
                    ucolmm += ', note="' + cobj.note + '"'
                }
            if (base != "all") {
                if (base.prodname) {
                    scomm += ' AND prodname="'+cobj.prodname+'"'
                }
                if (base.prodid) {
                    scomm += ' AND prodid="'+cobj.prodid+'"'
                }
                if (base.price) {
                    scomm += ' AND price="'+cobj.price+'"'
                }
                if (base.currency) {
                    scomm += ' AND currency="'+cobj.currency+'"'
                }
                if (base.register) {
                    scomm += ' AND register="'+cobj.register+'"'
                }
                if (base.note) {
                    scomm += ' AND note="'+cobj.note+'"'
                }
            }
        }
        // filtering bases/cobj

        ucomm = ucomm.replace(",", "");
        scomm = scomm.replace(" AND", " WHERE");

        // const cbase = Object.keys(base)[0];
        mysql_query("UPDATE product SET" + ucomm + scomm)
        .then((res_sql) => {
            // console.log(res_sql);
            res_end(res, 200, undefined, undefined, res_sql);
        })
        .catch((err) => {
            // console.log(err);
            if (err.includes("ER_DATA_TOO_LONG: Data too long for column 'prodname'")) {
                res_end(res, 705, "ERR: 'prodname' length exceed", "check prodname exceed");
            } else if (err.includes("ER_DATA_TOO_LONG: Data too long for column 'note'")) {
                res_end(res, 705, "ERR: 'note' length exceed", "check note exceed");
            } else {
                res_end(res, 403, err, "Search from DB", undefined, scomm + "\n" + ucomm);
            }
        })
    })

    // read
    app.get('/product', (req, res) => {
        const rule = req.body.rule; // format: String or JSON

        var scomm = "";

        // filtering rules
        if (rule != undefined) {
            if (rule != "all") {
                if (rule.prodname) {
                    scomm += ' AND prodname="'+cobj.prodname+'"'
                }
                if (rule.prodid) {
                    scomm += ' AND prodid="'+cobj.prodid+'"'
                }
                if (rule.price) {
                    scomm += ' AND price="'+cobj.price+'"'
                }
                if (rule.currency) {
                    scomm += ' AND currency="'+cobj.currency+'"'
                }
                if (rule.register) {
                    scomm += ' AND register="'+cobj.register+'"'
                }
                if (rule.note) {
                    scomm += ' AND note="'+cobj.note+'"'
                }
            }
            

            // filtering rules

            scomm = scomm.replace(" AND", " WHERE");

            // console.log(scomm);

            mysql_query("SELECT * FROM product" + scomm)
            .then((res_sql) => {
                // console.log(res_sql);
                res_end(res, 200, undefined, undefined, res_sql);
            })
            .catch((err) => {
                // console.log(err);
                res_end(res, 403, err, "Search from DB", undefined);
            })
        } else {
            res_end(res, 400, "Cannot find key 'rule'", "Filtering Convertion", undefined);
        }
    })

    // delete
    app.delete('/product', (req, res) => {
        const rule = req.body.rule; // format: String or JSON

        var scomm = "";

        // filtering rules
        if (rule != undefined) {
            if (rule != "all") {
                if (rule.prodname) {
                    scomm += ' AND prodname="'+cobj.prodname+'"'
                }
                if (rule.prodid) {
                    scomm += ' AND prodid="'+cobj.prodid+'"'
                }
                if (rule.price) {
                    scomm += ' AND price="'+cobj.price+'"'
                }
                if (rule.currency) {
                    scomm += ' AND currency="'+cobj.currency+'"'
                }
                if (rule.register) {
                    scomm += ' AND register="'+cobj.register+'"'
                }
                if (rule.note) {
                    scomm += ' AND note="'+cobj.note+'"'
                }
            }
            

            // filtering rules

            scomm = scomm.replace(" AND", " WHERE");

            // console.log(scomm);

            mysql_query("DELETE FROM product" + scomm)
            .then((res_sql) => {
                // console.log(res_sql);
                res_end(res, 200, undefined, undefined, res_sql);
            })
            .catch((err) => {
                // console.log(err);
                res_end(res, 403, err, "Delete from DB", undefined);
            })
        } else {
            res_end(res, 400, "Cannot find key 'rule'", "Filtering Convertion", undefined);
        }
    })

// product information api

module.exports = app;