const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const gridfsStorage = require('multer-gridfs-storage');
const gridfsStream = require('gridfs-stream');
const crypto = require('crypto');
const methodOverride = require('method-override');


const app = express();

// Middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));

//Templete Engine
app.set('view engine', 'ejs');

// DB config
const key = require('./config/key').MongoURI;

mongoose.connect(key, { useNewUrlParser: true })
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.log(err));

const conn = mongoose.connection;

// Init gfs
let gfs;

conn.once('open', () => {
    //Init Stream
    gfs = gridfsStream(conn.db, mongoose.mongo);
    gfs.collection('test');
})

// Create storage engine
const storage = new gridfsStorage({
    url: key,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'test'
                };
                resolve(fileInfo);
            });
        });
    }
});
const upload = multer({ storage });

// @route GET
// @desc Loads Form
app.get('/', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        if (!files || files.length === 0) {
            res.render('index', { files: false });
        } else {
            files.map(file => {
                if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
                    file.isImage = true;
                } else {
                    file.isImage = false;
                }
            });
            res.render('index', { files: files });
        }

    });
});

//@route POST /
//@desc Uploads file db 
app.post('/', upload.single('file'), (req, res) => {
    res.redirect('/');
});

//@route GET  /files
//@desc Display all the files in JSON
app.get('/files', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        if (!files || files.length === 0) {
            return res.status(404).json({
                err: 'No Files exists'
            });
        }
        return res.json(files);
    });
});

//@route GET  /files/:filename
//@desc Display one file in JSON
app.get('/files/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'No Files exists'
            });
        }
        return res.json(file);
    });
});

//@route GET  /image/:filename
//@desc Display Image
app.get('/image/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'No Files exists'
            });
        }
        // Check if image 
        if (file.contentType === 'image/jpeg' || file.contentType === 'image/png' || file.contentType === 'image/jpg') {
            // Read output to browser
            const readstream = gfs.createReadStream(file.filename);
            readstream.pipe(res);
        } else {
            res.status(404).json({
                err: 'Not an image'
            });
        }
    });
});

// @route DELETE /files/:id
// @desc Delete file
app.delete('/files/:id', (req, res) => {
    gfs.remove({ _id: req.params.id, root: 'test' }, (err, gridStore) => {
        if (err) {
            return res.status(404).json({ err: err });
        }
        res.redirect('/');
    })
})

const Port = 8000;

app.listen(Port, () => {
    console.log(`Server is runing on port: ${Port}`);
});