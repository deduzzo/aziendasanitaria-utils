const path = require("path");
const fs = require('fs');
module.exports = {
     getAllFilesInFolder: (folder) => {
        var files = fs.readdirSync(folder);
        var filesList = files.filter(function(e){
            return path.extname(e).toLowerCase() === '.txt'
        });
        return filesList;
    },
}