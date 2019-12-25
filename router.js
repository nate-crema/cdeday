module.exports = (app, fs, path, crypto, async, getIP, getTime, mysql_query) => {
    // test router
    // app.post('/', (req, res) => {
    //     res.end("true");
    // });


    // response function

    function res_end(res, code, err, err_position, cont) {
        res.json({
            status: code,
            contents: cont,
            error: {
                position: err_position,
                errors: err
            }
        });
    }





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

        // read

        // delete



    // photo upload function

    
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