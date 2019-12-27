module.exports = (app, fs, path, crypto, multer, async, getIP, getTime, mysql_query) => {
    // test router
    // app.post('/', (req, res) => {
    //     res.end("true");
    // });



    const server_mode = "development";


    // response function

    function res_end(res, code, err, err_position, cont) {
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

        const upload = multer({
            dest: '/photo/temp'
        });

        // upload
        app.post('/photo', upload.single(), (req, res) => {
            console.log(req.file);

            res.end();
        })

        // download

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