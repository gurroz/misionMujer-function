const gm = require('gm').subClass({imageMagick: true});
const fs = require('fs');
const request = require('request');
var AWS = require('aws-sdk');


/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.begin = (req, res) => {
  let message = req.query.message || req.body.message || 'Optimizing';

  let data = req.body;
  if(data && data.action == "optimize") {
      console.log("Beggening downloads");
      downloadImage(data.imageUrl);
  } else {

      console.log("Doing nothing", data);
  }


    res.set('Access-Control-Allow-Origin', "*");
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "3600");
  res.status(200).send(message);
};


function downloadImage(url) {

    let filename = url.substring(url.lastIndexOf('/')+1);

    let download = function(uri, filename, callback) {
        request.head(uri, function(err, res, body) {
            console.log('content-type:', res.headers['content-type']);
            console.log('content-length:', res.headers['content-length']);

            request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
        });
    };

    let filePath = '/tmp/' + filename;
    download(url, filePath, function() {
        optimizeImage(filePath, filename);
    });
}

function optimizeImage(filePath, originalName) {

    console.log('optimizeImage' + filePath);

    let destinationPath = "/tmp/opt_" + originalName;

    gm(filePath).size(function(err, value){
        console.log("Error sizong", err);
        console.log("Value is ", value);

        let width = value.width;
        let height = value.height;


        let newWidth = width;
        let newHeight = height;
        let newQuality = 80;
        if(width >= height && width > 1200) {
            newWidth = 1200;

            let proportion = newWidth/width;
            newHeight = height * proportion;
        } else if(height > width && height > 675) {
            newHeight = 675;

            let proportion = newHeight/height;
            newWidth = width * proportion;
        }

        gm(filePath).thumb(newWidth, newHeight, destinationPath, newQuality, function (err, stdout) {
            if (err) {
                console.error("Error optimzing", err);
                throw err;
            }
            readFileAndSend(destinationPath, originalName);
        });

    })
}

function readFileAndSend(filePath, originalName) {
    console.log('readFileAndSend' + filePath);

    fs.readFile(filePath, (err, fd) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.error('myfile does not exist');
                return;
            }
            throw err;
        }
        sendImageToAWS(fd, originalName);
    });
}

function sendImageToAWS(file, filename) {

    const region = 'us-east-1';
    const bucketName = 'misionmujerbucket';
    const IdentityPoolId = 'us-east-1:ad5897aa-d131-4333-9a80-e74dd375c7f1';

    AWS.config.update({
        region: region,
        credentials: new AWS.CognitoIdentityCredentials({
            IdentityPoolId: IdentityPoolId
        })
    });

    const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        params: { Bucket: bucketName}
    });

    s3.upload({ Key:filename, Bucket: bucketName, Body: file, ACL: 'public-read'},  (err, data) => {
        if (err) {
            console.error(err, 'there was an error uploading your file');
        } else {
            console.log('Uploaded iamge');
        }
    });
}