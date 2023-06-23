import moment from 'moment-timezone'
import excel from "excel-date-to-js";
import CodiceFiscaleUtils, {Parser} from '@marketto/codice-fiscale-utils';
const tz = "Europe/Rome";

const parseDateExcel = (excelTimestamp) => {
    let date = null;
    try {
        date = moment.utc(excel.getJsDateFromExcel(excelTimestamp));
    } catch (ex) {
        sails.log.error(excelTimestamp);
        return null;
    }
    if (!moment(date).isValid())
        return null;
    else return date.tz(tz).unix();
}

const compareDate = (unixDate1, unixDate2) => {
    return moment.unix(unixDate1).isSame(moment.unix(unixDate2), 'day');
}

const dataFromStringToUnix = (date) => {
    if (moment(date, 'DD/MM/YYYY').isValid())
        return moment(date, 'DD/MM/YYYY').unix();
    else
        return null;
}

const dataFromUnixToString = (date) => {
    if (moment.unix(date).isValid() && date != null)
        return moment.unix(date).format('DD/MM/YYYY');
    else
        return null;
}

const nowToUnixDate = () => {
    return moment().unix();
}

const replacer = (key, value) => {
    if (value instanceof Map) {
        return {
            dataType: 'Map',
            value: Array.from(value.entries()), // or with spread: value: [...value]
        };
    } else {
        return value;
    }
}


const getAgeFromCF = (codiceFiscale) => {
    // Estrai la data di nascita dal codice fiscale
    const birthdate = moment(Parser.cfToBirthDate(codiceFiscale));

    let years = moment().diff(birthdate, 'years',false);

    return years;
}

export const utility = {nowToUnixDate, dataFromUnixToString, dataFromStringToUnix, parseDateExcel, compareDate,getAgeFromCF,replacer}
