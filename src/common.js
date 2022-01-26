import path from "path";
import fs from 'fs';

const getAllFilesRecursive = (dirPath, extensions, arrayOfFiles) => {
    let files = fs.readdirSync(dirPath)

    arrayOfFiles = arrayOfFiles || []

    files.forEach(function (file) {
        if (fs.statSync(dirPath + path.sep + file).isDirectory()) {
            arrayOfFiles = getAllFilesRecursive(dirPath + path.sep + file, extensions, arrayOfFiles)
        } else {
            //arrayOfFiles.push(path.join(__dirname, dirPath, "/", file))
            if (extensions.includes(path.extname(file).toLowerCase()))
                arrayOfFiles.push(path.join(dirPath, path.sep, file))
        }
    })
    return arrayOfFiles
}

const getAllFilesInFolder = (folder) => {
        var files = fs.readdirSync(folder);
        var filesList = files.filter(function(e){
            return path.extname(e).toLowerCase() === '.txt'
        });
        return filesList;
    }


export const common = {getAllFilesInFolder, getAllFilesRecursive}