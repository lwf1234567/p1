import fs = require('fs');
import xlsx = require('node-xlsx');
const argv = require('yargs').argv;

let xlsxPath: string = argv.xlsxPath || process.cwd();
let os: string = argv.os || 'windows';

let outPath: string = null;
if (os == 'mac') {
    outPath = `${xlsxPath}/outFile`;
} else {
    outPath = `${xlsxPath}\\outFile`;
}

console.log(`读取目录：${xlsxPath}  读取系统：${os}`);

fs.readdir(xlsxPath, function (err: NodeJS.ErrnoException, files: string[]): void {
    if (err) {
        console.log(`读取目录失败:${err.message}`);
        return;
    }
    if (!fs.existsSync(outPath)) {
        fs.mkdirSync(outPath);
    }

    let clientDir: string = `${outPath}\\client`;
    let serverDir: string = `${outPath}\\server`;

    // 如果是mac的话，切换路径方式
    if (os == 'mac') {
        clientDir = `${outPath}/client`;
        serverDir = `${outPath}/server`;
    }

    if (!fs.existsSync(clientDir)) {
        fs.mkdirSync(clientDir);
    }
    if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir);
    }
    //创建客户端代码结构
    let defFileStr: string = `/**\n * 该文件为工具自动生成，请勿自行修改。\n *\n */\n`;
    let templete: string = `export class {0} {\n{1}}\n`
    //读取文件
    if (files) {
        for (let i: number = 0, iLen: number = files.length; i < iLen; i++) {
            let file: string = files[i];
            if (file.indexOf('.xlsx') >= 0 && file.indexOf('~$') == -1) {
                console.log(`读取文件：${file}`);
                let fileDir = `${xlsxPath}\\${file}`;
                if (os == 'mac') {
                    fileDir = `${xlsxPath}/${file}`;
                }
                let buffer: Buffer = fs.readFileSync(fileDir);
                const sheets: any[] = xlsx.parse(buffer);
                if (sheets.length == 0) {
                    return;
                }
                let sheet: any = sheets[0];
                let sheetData: any[][] = sheet.data;
                //解析结构数据
                let fileName: string = sheetData[0][1];
                let remarks: string[] = sheetData[1];
                let channels: number[] = sheetData[3];
                let keys: string[] = sheetData[4];
                let types: string[] = sheetData[5];
                //创建客户端配置定义代码
                let keyTemplate: string = "";
                for (let i: number = 0, iLen: number = keys.length; i < iLen; i++) {
                    let channel: number = channels[i];
                    switch (channel & 1) {
                        case 1:
                        case 3:
                            let remark: string = remarks[i] || "";
                            remark = remark.replace(/\n/g, '\n   * ');
                            let remarkStr = `  \/**\n   * ${remark}\n   *\/`;
                            let variableStr = `public ${keys[i]}: ${formatKeyType(types[i])};\n`
                            keyTemplate += `${remarkStr}\n  ${variableStr}`;
                            break;
                    }
                }
                defFileStr += formatString(templete, [fileName, keyTemplate]);
                //创建文件数据
                let clientData: any = {};
                let serverData: any = {};
                clientData.name = fileName;
                serverData.name = fileName;
                let startIndex: number = 6;
                clientData.key = keys[0];
                serverData.key = keys[0];
                clientData.data = [];
                serverData.data = [];
                //解析表数据
                for (let i: number = startIndex, iLen: number = sheetData.length; i < iLen; i++) {
                    let rowData: any[] = sheetData[i];
                    if (rowData && rowData.length > 0) {
                        let data_client: any = {};
                        let data_server: any = {};
                        for (let j: number = 0, jLen: number = rowData.length; j < jLen; j++) {
                            let channel: number = channels[j];
                            switch (channel & 1) {
                                case 1:
                                    data_client[keys[j]] = formatValueType(types[j], rowData[j]);
                                    break;
                                case 2:
                                    data_server[keys[j]] = rowData[j];
                                    break;
                                case 3:
                                    data_client[keys[j]] = formatValueType(types[j], rowData[j]);
                                    data_server[keys[j]] = rowData[j];
                                    break;
                            }
                        }

                        clientData.data.push(data_client);
                        serverData.data.push(data_server);
                    }
                }
                //创建配置文件
                let clientFilePath: string = `${outPath}\\client\\${fileName}.txt`;
                let serverFilePath: string = `${outPath}\\server\\${fileName}.txt`;

                if (os == 'mac') {
                    clientFilePath = `${outPath}/client/${fileName}.txt`;
                    serverFilePath = `${outPath}/server/${fileName}.txt`;
                }
                writeFile(clientFilePath, JSON.stringify(clientData));
                writeFile(serverFilePath, JSON.stringify(serverData));
            }
        }
    }
    let defFileName: string = 'ConfigDef';
    let defFilePath: string = `${outPath}\\client\\${defFileName}.ts`;
    if (os == 'mac') {
        defFilePath = `${outPath}/client/${defFileName}.ts`;
    }
    writeFile(defFilePath, defFileStr);
})

function writeFile(path: string, data: any): void {
    let fd: number = fs.openSync(path, 'w');
    fs.writeFileSync(path, data, { flag: 'w' });
    fs.closeSync(fd);
    console.log(`创建文件成功：${path}`);
}

/**
 *  字符参数替换
 * @param str       "参数替换{0}和{1}"
 * @param args      [x,y]    
 */
function formatString(str: string, args: string[]): string {
    if (str) {
        let reg: RegExp = /\{[0-9]+?\}/;
        while (str.match(reg)) {
            let arr: RegExpMatchArray = str.match(reg);
            let arg: RegExpMatchArray = arr[0].match(/[0-9]+?/);
            str = str.replace(reg, args[parseInt(arg[0])]);
        }
        return str;
    }
    return "";
}

function formatKeyType(type: string): string {
    switch (type) {
        case "int32":
        case "float":
            return "number";
        case "string":
            return "string";
        case "boolean":
            return "boolean";
        default:
            throw new TypeError(`${type}类型未定义`);
    }
}

function formatValueType(type: string, value: any): any {
    switch (type) {
        case "int32":
        case "float":
            if (isNaN(value)) {
                return null;
            } else {
                return Number(value);
            }
        case "string":
            if (value === null || value === undefined) {
                return null;
            }
            return value + "";
        case "boolean":
            return Boolean(value);
        default:
            throw new Error(`${type}类型未定义`);
    }
}