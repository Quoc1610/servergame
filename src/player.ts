
class Player{

    name : string;
    address : string;
    port : number;
    id : string;
    gun_id : number;
    in_room : boolean = false;
    constructor(id : string, address : string, port : number, gun_id : number = 1 ,name : string = "quoc")
    {   
        this.name = name;
        this.id = id;
        this.address = address;
        this.port = port;
        this.gun_id = gun_id;
    }    
}

export default Player;