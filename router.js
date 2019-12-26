module.exports = (app, fs, path, crypto, multer, async, getIP, utf8, iconv, mime, mimeTypes, getTime, makeid, mysql_query) => {
    // test router
    // app.post('/', (req, res) => {
    //     res.end("true");
    // });



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



    // Authorizing





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
                        res_end(res, 200, undefined, undefined, "complete");
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

            ucomm = ucomm.replace(",", "");

            const cbase = Object.keys(base)[0];
            mysql_query("UPDATE reserv SET" + ucomm + " WHERE " + cbase + "='" + base[cbase] + "'")
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
                    console.log(files);

                    // create photoid

                    const random_fdigit = makeid(5);

                    var photoid = uploadtime + "%#$" + random_fdigit + "uid" + uploader + Date.now();
                    photoid = crypto.createHash('sha512').update(photoid).digest('base64').replace("==", "");
                    console.log(photoid);
                    
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

                    console.log(fs.existsSync(fileTmpSaved));
                    console.log(fs.existsSync(path.join(newSaveDir, fileSaveName)));
                    console.log(fs.existsSync(newSaveDir));

                    fs.rename(fileTmpSaved, path.join(newSaveDir, fileSaveName), (err) => {
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
                        console.log(res_sql);
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
                        console.log(res_sql);
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
                    res.setHeader('Content-disposition', 'attachment; filename=' + fileName);
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

    // delete

    
    // user function
        // create

        // update

        // read

        // delete


    // community function
        // create

        // update

        // read

        // delete


    // pay function
        // request

        // cancel

        // find (load logs)

    
}