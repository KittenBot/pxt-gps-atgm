/*
Riven
load dependency
"kittenwifi": "file:../pxt-gps-atgm"
*/

//% color="#4c6ef5" weight=10 icon="\uf0ac"
namespace gps {

    const pi = 3.141592653589793
    const a = 6378245
    const ee = 0.006693421622965943

    let timezone = +8;
    let hh: number;
    let mm: number;
    let ss: number;
    let yy: number;
    let MM: number;
    let dd: number;

    let longitude:number;
    let latitude:number;
    let dir: number;
    let speed: number;

    let sqrtMagic = 0
    let magic = 0
    let radLat = 0
    let mgLat: number;
    let mgLon: number;

    type EvtAct = () => void;
    let gpsGotPosition: EvtAct = null;

    export enum TimeType {
        SS = 1,
        MM = 2,
        HH = 3,
    }

    export enum DateType {
        YY = 1,
        MM = 2,
        DD = 3,
    }

    export enum PosType {
        Longitude = 1,
        Latitude = 2
    }

    const PortSerial = [
        [SerialPin.P8, SerialPin.P0],
        [SerialPin.P12, SerialPin.P1],
        [SerialPin.P13, SerialPin.P2],
        [SerialPin.P15, SerialPin.P14]
    ]

    export enum SerialPorts {
        PORT1 = 0,
        PORT2 = 1,
        PORT3 = 2,
        PORT4 = 3
    }

    function calcgps(n: string) {
        let t = parseFloat(n)
        let a = Math.idiv(t, 100) // 22
        let b = (t - a * 100) / 60 + a
        return b;
    }

    function transformLat(x: number, y: number): number {
        let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y
            + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * pi) + 40.0 * Math.sin(y / 3.0 * pi)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * pi) + 320 * Math.sin(y * pi / 30.0)) * 2.0 / 3.0;
        return ret;
    }
    function transformLon(x: number, y: number): number {
        let ret2 = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1
            * Math.sqrt(Math.abs(x));
        ret2 += (20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0 / 3.0;
        ret2 += (20.0 * Math.sin(x * pi) + 40.0 * Math.sin(x / 3.0 * pi)) * 2.0 / 3.0;
        ret2 += (150.0 * Math.sin(x / 12.0 * pi) + 300.0 * Math.sin(x / 30.0
            * pi)) * 2.0 / 3.0;
        return ret2;
    }

    function gps84Togcj02 (lat: number, lon: number) {
        let dLat = transformLat(lon - 105.0, lat - 35.0);
        let dLon = transformLon(lon - 105.0, lat - 35.0);
        radLat = lat / 180 * pi
        magic = Math.sin(radLat)
        magic = 1 - ee * magic * magic
        sqrtMagic = Math.sqrt(magic)
        dLat = dLat * 180 / (a * (1 - ee) / (magic * sqrtMagic) * pi)
        dLon = dLon * 180 / (a / sqrtMagic * Math.cos(radLat) * pi)
        mgLat = lat + dLat
        mgLon = lon + dLon
    }

    /**
     * init serial port
     * @param tx Tx pin; eg: SerialPin.P1
     * @param rx Rx pin; eg: SerialPin.P2
    */
    //% blockId=nbiot_init block="GPS init|Rx pin %rx"
    //% weight=100
    export function gps_init(rx: SerialPin): void {
        serial.redirect(
            SerialPin.USB_TX,
            rx,
            BaudRate.BaudRate9600
        )
        basic.pause(100)
        serial.setRxBufferSize(128)
        serial.readString()
        serial.writeString('\n\n')
        basic.pause(1000)
    }

    //% blockId=gps_init_pw block="GPS init powerbrick|Port %port"
    //% weight=100
    export function gps_init_pw(port: SerialPorts): void {
        gps_init(PortSerial[port][0]);
    }

    serial.onDataReceived('\n', function () {
        let a = serial.readString()
        if (a.charAt(0) == '$') {
            let tmp = a.slice(1, a.length).split(",")
            if (tmp[0] == 'GNRMC'){
                //console.log(tmp.join(" "))
                let utc = tmp[1]
                hh = parseInt(utc.slice(0, 2)) + timezone
                mm = parseInt(utc.slice(2, 4))
                ss = parseInt(utc.slice(4, 6))
                
                let mode = tmp[2]
                if (mode == "A"){
                    latitude = calcgps(tmp[3])
                    if (tmp[4] == 'S') latitude = -latitude;
                    longitude = calcgps(tmp[5])
                    if (tmp[6] == 'W') longitude = -longitude;
                    speed = parseFloat(tmp[7]) * 1.852
                    dir = parseFloat(tmp[8])

                    let date = tmp[9]
                    dd = parseInt(date.slice(0, 2))
                    MM = parseInt(date.slice(2, 4))
                    yy = parseInt(date.slice(4, 6))
                }
                if (gpsGotPosition) gpsGotPosition();
                //console.log(`time: ${yy}/${MM}/${dd} ${hh}:${mm}:${ss}`)
                //console.log(longitude + "," + latitude)
            }
        }
    })

    //% blockId=gps_got_position block="on Gps Got Position"
    //% weight=99
    export function gps_got_position(handler: () => void) {
        gpsGotPosition = handler;
    }

    //% blockId=gps_date block="Read GPS date%date"
    //% weight=80
    export function gps_date(date: DateType): number {
        switch (date){
            case DateType.DD:
                return dd;
            case DateType.MM:
                return MM;
            case DateType.YY:
                return yy;
        }
    }

    //% blockId=gps_date_text block="Read GPS date text"
    //% weight=80
    export function gps_date_text(): string {
        return `${yy } /${MM}/${dd }`
    }

    //% blockId=gps_time block="Read GPS time%time"
    //% weight=80
    export function gps_time(time: TimeType): number {
        switch (time) {
            case TimeType.SS:
                return ss;
            case TimeType.MM:
                return mm;
            case TimeType.HH:
                return hh;
        }
    }

    //% blockId=gps_time_text block="Read GPS time text"
    //% weight=80
    export function gps_time_text(): string {
        return `${hh}:${mm}:${ss}`
    }

    //% blockId=gps_position block="Read GPS Position%pos"
    //% weight=80
    export function gps_position(pos: PosType): number {
        switch (pos) {
            case PosType.Latitude:
                return latitude;
            case PosType.Longitude:
                return longitude;
        }
    }

    //% blockId=gps_to_mars block="GPS Translate to Mars position"
    //% weight=80
    //% advanced=true
    export function gps_to_mars() {
        gps84Togcj02(latitude, longitude)
    }

    //% blockId=gps_position_mars block="Read GPS Mars Position%pos"
    //% weight=80
    //% advanced=true
    export function gps_position_mars(pos: PosType): number {
        switch (pos) {
            case PosType.Latitude:
                return mgLat;
            case PosType.Longitude:
                return mgLon;
        }
    }


}
